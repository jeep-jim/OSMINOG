import importlib.util
import json
import os
import subprocess
import tempfile
from pathlib import Path
import unittest
from urllib.parse import quote

spec = importlib.util.spec_from_file_location('mouse_linux_install', Path(__file__).with_name('mouse-linux-install-verify.py'))
install = importlib.util.module_from_spec(spec)
spec.loader.exec_module(install)

SOURCES = '''# URI in a comment stays https://archive.ubuntu.com/ubuntu/
Types: deb
URIs: http://archive.ubuntu.com/ubuntu/
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs:\thttps://security.ubuntu.com/ubuntu/  http://archive.ubuntu.com/ubuntu
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
Check-Valid-Until: yes

Types: deb
URIs: https://example.invalid/http://archive.ubuntu.com/ubuntu/
Suites: unchanged
Signed-By: /keep/this/keyring
'''

HOST_SOURCES = '''Types: deb
URIs: mirror+file:@MIRRORS@
Suites: noble noble-updates noble-backports
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg

Types: deb
URIs: mirror+file:@MIRRORS@
Suites: noble-security
Components: main restricted universe multiverse
Signed-By: /usr/share/keyrings/ubuntu-archive-keyring.gpg
Check-Valid-Until: yes
'''

RUNNER_MIRRORS = ('http://us-east-2.ec2.archive.ubuntu.com/ubuntu/\tpriority:1\n'
                  'https://archive.ubuntu.com/ubuntu/\tpriority:2\n'
                  'https://security.ubuntu.com/ubuntu/\tpriority:3\n')


def bootstrap_script():
    lines = (Path(__file__).parents[1] / '.github/workflows/mouse-linux.yml').read_text().splitlines()
    start = lines.index('      - name: Install native Ubuntu 24.04 test session tools')
    stop = next(i for i in range(start + 1, len(lines)) if lines[i].startswith('      - '))
    run = next(i for i in range(start, stop) if lines[i] == '        run: |')
    return '\n'.join(line[10:] for line in lines[run + 1:stop]) + '\n'


class CleanInstallBindingTests(unittest.TestCase):
    def test_dependency_probe_is_valid_bash(self):
        subprocess.run(['bash', '-n'], input=install.CLEAN_INSTALL, text=True, check=True)

    def test_official_https_archives_precede_recognized_cloud_fallback(self):
        for host in ('azure.archive.ubuntu.com', 'us-east-2.ec2.archive.ubuntu.com'):
            raw = (f'http://{host}/ubuntu/\tpriority:1\nhttps://archive.ubuntu.com/ubuntu/\tpriority:2\n'
                   'https://security.ubuntu.com/ubuntu/\tpriority:3\n')
            self.assertEqual(install.apt_mirrors(raw),
                             'https://archive.ubuntu.com/ubuntu/\tpriority:1\n'
                             'https://security.ubuntu.com/ubuntu/\tpriority:2\n'
                             f'http://{host}/ubuntu/\tpriority:3\n')
        fallback = install.apt_mirrors('')
        for unsafe in ('file:/host/packages', 'http://user@azure.archive.ubuntu.com/ubuntu/',
                       'https://azure.archive.ubuntu.com.evil/ubuntu/', 'http://azure.archive.ubuntu.com:80/ubuntu/',
                       'http://azure.archive.ubuntu.com/ubuntu/?trusted=yes'):
            with self.subTest(unsafe=unsafe):
                self.assertEqual(install.apt_mirrors(unsafe), fallback)

    def test_actual_shell_changes_only_ubuntu_uri_tokens_and_preserves_trust_fields(self):
        with tempfile.TemporaryDirectory() as root:
            sources, mirrors = Path(root) / 'ubuntu.sources', Path(root) / 'mirrors.txt'
            ca = Path(root) / 'ca.crt'; ca.write_text('Public CA fixture; no TLS request runs in this unit test\n')
            sources.write_text(SOURCES); sources.chmod(0o644)
            mirrors.write_text(install.apt_mirrors(''))
            before_hash = install.VERIFY.sha256(sources)
            command = ['bash', '-euo', 'pipefail', '-c', install.APT_SOURCE_SETUP +
                       '\nconfigure_apt_transport "$1" "$2" "$3"', 'probe', str(sources), str(mirrors), str(ca)]
            result = subprocess.run(command, text=True, capture_output=True, check=True)
            expected = SOURCES.replace('URIs: http://archive.ubuntu.com/ubuntu/', f'URIs: mirror+file:{mirrors}')
            expected = expected.replace('URIs:\thttps://security.ubuntu.com/ubuntu/  http://archive.ubuntu.com/ubuntu',
                                        f'URIs:\tmirror+file:{mirrors}  mirror+file:{mirrors}')
            self.assertEqual(sources.read_text(), expected)
            self.assertEqual(sources.stat().st_mode & 0o777, 0o644)
            self.assertIn(before_hash, result.stdout)
            self.assertIn(install.VERIFY.sha256(sources), result.stdout)
            self.assertIn(install.VERIFY.sha256(mirrors), result.stdout)
            self.assertIn(install.VERIFY.sha256(ca), result.stdout)
            subprocess.run(command, text=True, capture_output=True, check=True)
            self.assertEqual(sources.read_text(), expected, 'Reapplying the same transport is idempotent')

    def test_unknown_sources_fail_before_any_source_mutation(self):
        with tempfile.TemporaryDirectory() as root:
            sources, mirrors = Path(root) / 'ubuntu.sources', Path(root) / 'mirrors.txt'
            ca = Path(root) / 'ca.crt'; ca.write_text('Public CA unit fixture\n')
            original = 'Types: deb\nURIs: http://example.invalid/ubuntu/\nSigned-By: /original/key\n'
            sources.write_text(original); mirrors.write_text(install.apt_mirrors(''))
            result = subprocess.run(['bash', '-euo', 'pipefail', '-c', install.APT_SOURCE_SETUP +
                                     '\nconfigure_apt_transport "$1" "$2" "$3"', 'probe', str(sources), str(mirrors), str(ca)],
                                    env={**os.environ, 'TMPDIR': root}, text=True, capture_output=True)
            self.assertEqual(result.returncode, 24)
            self.assertEqual(sources.read_text(), original)

    def test_docker_receives_only_candidate_mirror_and_single_ca_readonly_mounts(self):
        with tempfile.TemporaryDirectory(prefix='mouse apt ') as root:
            deb, mirrors = Path(root) / 'candidate.deb', Path(root) / 'mirrors.log'
            ca = Path(root) / 'ca.crt'; ca.write_text('Public CA unit fixture\n')
            command = install.clean_dependency_command(deb, mirrors, ca)
            self.assertEqual(command[:4], ['docker', 'run', '--rm', '--pull=always'])
            self.assertEqual([command[i + 1] for i, word in enumerate(command) if word == '--mount'],
                             [f'type=bind,src={deb},dst=/candidate.deb,readonly',
                              f'type=bind,src={mirrors},dst={install.MIRROR_TARGET},readonly',
                              f'type=bind,src={ca},dst={install.CA_TARGET},readonly'])
            self.assertEqual(command[10:], ['ubuntu:24.04', 'bash', '-c', install.CLEAN_INSTALL,
                                           'mouse-clean-install', '/etc/apt/sources.list.d/ubuntu.sources',
                                           install.MIRROR_TARGET, install.CA_TARGET])
            for index in range(3):
                for separator in (',readonly=false', '\n', '\r'):
                    values = [deb, mirrors, ca]; values[index] = Path(root) / ('bad' + separator)
                    with self.subTest(index=index, separator=separator), self.assertRaisesRegex(RuntimeError, 'unsupported separator'):
                        install.clean_dependency_command(*values)

    def test_missing_empty_or_directory_ca_is_rejected_before_docker(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root); empty = directory / 'empty.crt'; empty.touch()
            for ca in (directory / 'missing.crt', empty, directory):
                with self.subTest(ca=ca), self.assertRaisesRegex(RuntimeError, 'CA bundle is missing or empty'):
                    install.clean_dependency_command(directory / 'candidate.deb', directory / 'mirrors.txt', ca)

    def test_empty_ca_aborts_shell_before_sources_change_or_apt(self):
        with tempfile.TemporaryDirectory() as root:
            directory = Path(root); sources, mirrors, ca = (directory / name for name in ('ubuntu.sources', 'mirrors.txt', 'empty.crt'))
            sources.write_text(SOURCES); mirrors.write_text(install.apt_mirrors('')); ca.touch()
            result = subprocess.run(['bash', '-c', install.CLEAN_INSTALL, 'probe', str(sources), str(mirrors), str(ca)],
                                    text=True, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(sources.read_text(), SOURCES)
            self.assertNotIn('MOUSE_APT_OPTIONS', result.stdout)
            self.assertNotIn('MOUSE_LINUX_CLEAN_DEB_DEPENDENCIES_PASS', result.stdout)

    def test_apt_errors_abort_actual_clean_script_before_success_marker(self):
        for failed_phase, code in [('update', 41), ('install', 42)]:
            with self.subTest(phase=failed_phase), tempfile.TemporaryDirectory() as root:
                directory = Path(root); binary = directory / 'bin'; binary.mkdir()
                sources, mirrors, calls = directory / 'ubuntu.sources', directory / 'mirrors.txt', directory / 'calls'
                ca = directory / 'ca.crt'; ca.write_text('Public CA unit fixture\n')
                sources.write_text(SOURCES); mirrors.write_text(install.apt_mirrors(''))
                apt = binary / 'apt-get'
                apt.write_text('#!/bin/bash\nprintf "%s\\n" "$*" >> "$APT_CALLS"\n'
                               'case " $* " in *" $APT_FAIL "*) exit "$APT_EXIT";; esac\n')
                apt.chmod(0o755)
                result = subprocess.run(['bash', '-c', install.CLEAN_INSTALL, 'probe', str(sources), str(mirrors), str(ca)],
                                        env={**os.environ, 'PATH': str(binary) + os.pathsep + os.environ['PATH'],
                                             'TMPDIR': root, 'APT_CALLS': str(calls), 'APT_FAIL': failed_phase, 'APT_EXIT': str(code)},
                                        text=True, capture_output=True)
                self.assertEqual(result.returncode, code, result.stderr)
                self.assertNotIn('MOUSE_LINUX_CLEAN_DEB_DEPENDENCIES_PASS', result.stdout)
                commands = calls.read_text().splitlines()
                self.assertEqual(len(commands), 1 if failed_phase == 'update' else 2)
                self.assertIn('update --error-on=any', commands[0])
                for command in commands:
                    for option in ('Acquire::http::Timeout=15', 'Acquire::https::Timeout=15', 'Acquire::Retries=1'):
                        self.assertIn(option, command)
                    for option in (f'Acquire::https::CAInfo={ca}', 'Acquire::https::Verify-Peer=true',
                                   'Acquire::https::Verify-Host=true', 'Acquire::AllowInsecureRepositories=false',
                                   'APT::Get::AllowUnauthenticated=false'):
                        self.assertIn(option, command)
                if failed_phase == 'install':
                    self.assertTrue(commands[1].endswith('install --no-install-recommends -y /candidate.deb'))

    def test_install_rejects_bytes_or_source_that_differ_from_native_candidate(self):
        with tempfile.TemporaryDirectory() as root:
            deb = Path(root) / 'Mouse-Browser-6.0.41-Linux-x64.deb'
            deb.write_bytes(b'package-byte-binding-fixture')
            source = 'a' * 40
            manifest = {'version': '6.0.41', 'source': source, 'platform': 'linux', 'arch': 'x64',
                        'packages': {deb.name: {'size': deb.stat().st_size, 'sha256': install.VERIFY.sha256(deb)}}}
            install.verify_manifest(manifest, deb, source)
            for change in ({'source': 'b' * 40}, {'version': '6.0.37'}, {'platform': 'win32'}, {'arch': 'arm64'}):
                with self.subTest(change=change), self.assertRaisesRegex(RuntimeError, 'wrong source/version/platform'):
                    install.verify_manifest({**manifest, **change}, deb, source)
            changed = json.loads(json.dumps(manifest))
            changed['packages'][deb.name]['sha256'] = '0' * 64
            with self.assertRaisesRegex(RuntimeError, 'package bytes'):
                install.verify_manifest(changed, deb, source)
            deb.write_bytes(b'package-byte-binding-mutated')
            with self.assertRaisesRegex(RuntimeError, 'package bytes'):
                install.verify_manifest(manifest, deb, source)


class HostBootstrapTests(unittest.TestCase):
    def prepare_fixture(self, directory, phase, expected, source_text=None):
        binary = directory / 'bin'; binary.mkdir()
        sources, mirrors = directory / 'ubuntu.sources', directory / 'apt-mirrors.txt'
        sources.write_text((HOST_SOURCES if source_text is None else source_text).replace('@MIRRORS@', quote(str(mirrors), safe='/')))
        mirrors.write_text(RUNNER_MIRRORS)
        sudo = binary / 'sudo'
        sudo.write_text('''#!/bin/bash
set -euo pipefail
test "$1" = -n; shift
printf '%s\\n' "$*" >> "$PRIVILEGED_CALLS"
if test "$1" = install; then
  test "$#" -eq 6
  test "$2" = -m && test "$3" = 0644 && test "$4" = --
  test "$5" = mouse-linux-noble-host-mirrors.log && test "$6" = "$APT_MIRROR_PATH"
  if test "$APT_FAIL" = config; then exit "$APT_EXIT"; fi
  exec "$@"
fi
case " $* " in *" apt-get "*) ;; *) exit 92;; esac
printf '%s\\n' "$*" >> "$APT_CALLS"
case " $* " in *" $APT_FAIL "*) exit "$APT_EXIT";; esac
''')
        sudo.chmod(0o755)
        (binary / 'id').write_text('#!/bin/bash\nprintf "1001\\n"\n'); (binary / 'id').chmod(0o755)
        if phase == 'timeout':
            (binary / 'timeout').write_text('#!/bin/bash\nexit 124\n'); (binary / 'timeout').chmod(0o755)
        # Execute the real workflow body; only filesystem locations move into this fixture.
        script = bootstrap_script().replace('/etc/apt/sources.list.d/ubuntu.sources', str(sources))
        script = script.replace('/etc/apt/apt-mirrors.txt', str(mirrors))
        script = script.replace('../tools/mouse-linux-install-verify.py', str(Path(install.__file__).resolve()))
        env = {**os.environ, 'PATH': str(binary) + os.pathsep + os.environ['PATH'],
               'APT_CALLS': str(directory / 'calls'), 'PRIVILEGED_CALLS': str(directory / 'privileged'),
               'APT_MIRROR_PATH': str(mirrors), 'APT_FAIL': phase, 'APT_EXIT': str(expected)}
        return script, env, sources, mirrors

    def test_workflow_bootstrap_has_valid_bash(self):
        subprocess.run(['bash', '-n'], input=bootstrap_script(), text=True, check=True)

    def test_host_cli_checks_binding_and_only_prints_shared_https_first_list(self):
        with tempfile.TemporaryDirectory(prefix='mouse host apt ') as root:
            directory = Path(root); _, _, sources, mirrors = self.prepare_fixture(directory, 'success', 0)
            original = sources.read_bytes(), mirrors.read_bytes()
            result = subprocess.run(['python3', install.__file__, '--host-mirrors', str(sources), str(mirrors)],
                                    text=True, capture_output=True, check=True)
            self.assertEqual(result.stdout, install.apt_mirrors(RUNNER_MIRRORS))
            self.assertEqual((sources.read_bytes(), mirrors.read_bytes()), original, 'The CLI must be read-only')
            self.assertEqual(install.apt_mirrors(result.stdout), result.stdout, 'Host and container reuse the same stable order')

    def test_unbound_or_additional_uri_fails_before_any_privileged_write_or_apt(self):
        invalid = [
            '# URIs: mirror+file:@MIRRORS@\nTypes: deb\n',
            HOST_SOURCES.replace('mirror+file:@MIRRORS@', 'mirror+file:@MIRRORS@.wrong'),
            HOST_SOURCES.replace('mirror+file:@MIRRORS@', 'http://archive.ubuntu.com/ubuntu/'),
            HOST_SOURCES.replace('URIs: mirror+file:@MIRRORS@', 'URIs: mirror+file:@MIRRORS@\n https://example.invalid/ubuntu/'),
        ]
        for source_text in invalid:
            with self.subTest(source=source_text), tempfile.TemporaryDirectory(prefix='mouse host apt ') as root:
                directory = Path(root)
                script, env, sources, mirrors = self.prepare_fixture(directory, 'success', 0, source_text)
                original = sources.read_bytes(), mirrors.read_bytes()
                result = subprocess.run(['bash', '-euo', 'pipefail', '-c', script], cwd=directory,
                                        env=env, text=True, capture_output=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('exact mirror list', result.stdout)
                self.assertEqual((sources.read_bytes(), mirrors.read_bytes()), original)
                self.assertFalse((directory / 'privileged').exists())
                self.assertFalse((directory / 'calls').exists())
                self.assertNotIn('MOUSE_NOBLE_HOST_TOOLS_PASS', result.stdout)

    def test_workflow_preserves_apt_failure_timeout_and_success_through_tee(self):
        for phase, expected in [('config', 45), ('update', 43), ('install', 44), ('timeout', 124), ('success', 0)]:
            with self.subTest(phase=phase), tempfile.TemporaryDirectory(prefix='mouse host apt ') as root:
                directory = Path(root)
                script, env, sources, mirrors = self.prepare_fixture(directory, phase, expected)
                original_sources, original_mirrors_hash = sources.read_bytes(), install.VERIFY.sha256(mirrors)
                calls = directory / 'calls'
                result = subprocess.run(['bash', '-euo', 'pipefail', '-c', script], cwd=directory,
                                        env=env, text=True, capture_output=True)
                self.assertEqual(result.returncode, expected, result.stderr)
                log = (directory / 'mouse-linux-noble-host-tools.log').read_text()
                self.assertIn(f'MOUSE_NOBLE_HOST_TOOLS_EXIT timeout={expected} tee=0', log)
                self.assertEqual('MOUSE_NOBLE_HOST_TOOLS_PASS' in log, phase == 'success')
                self.assertEqual(sources.read_bytes(), original_sources)
                if phase in ('config', 'timeout'):
                    self.assertEqual(mirrors.read_text(), RUNNER_MIRRORS)
                    self.assertFalse(calls.exists())
                    continue
                self.assertEqual(mirrors.read_text(), install.apt_mirrors(RUNNER_MIRRORS))
                self.assertEqual(mirrors.stat().st_mode & 0o777, 0o644)
                for marker in ('SOURCES_BEFORE', 'SOURCES_AFTER', 'MIRRORS_BEFORE', 'MIRRORS_AFTER'):
                    self.assertIn('MOUSE_NOBLE_HOST_APT_' + marker, log)
                for digest in (original_mirrors_hash, install.VERIFY.sha256(mirrors), install.VERIFY.sha256(sources)):
                    self.assertIn(digest, log)
                self.assertIn(str(len(original_sources)) + ' ' + str(sources), log)
                self.assertIn(str(mirrors.stat().st_size) + ' ' + str(mirrors), log)
                privileged = (directory / 'privileged').read_text().splitlines()
                self.assertEqual(privileged[0], 'install -m 0644 -- mouse-linux-noble-host-mirrors.log ' + str(mirrors))
                if phase == 'update':
                    self.assertNotIn('MOUSE_NOBLE_HOST_APT_INSTALL', log)
                commands = calls.read_text().splitlines()
                self.assertEqual(len(commands), 1 if phase == 'update' else 2)
                for command in commands:
                    for option in ('Acquire::http::Timeout=15', 'Acquire::https::Timeout=15', 'Acquire::Retries=1',
                                   'Acquire::https::Verify-Peer=true', 'Acquire::https::Verify-Host=true',
                                   'Acquire::AllowInsecureRepositories=false', 'APT::Get::AllowUnauthenticated=false'):
                        self.assertIn(option, command)


if __name__ == '__main__':
    unittest.main()
