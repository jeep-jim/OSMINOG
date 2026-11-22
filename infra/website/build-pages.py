#!/usr/bin/env python3
"""Build an isolated Pages artifact, with byte-exact installers unless --check-only."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import resource
import shutil
import stat
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
INFRA = ROOT / 'infra' / 'website'
MAX_TOTAL_BYTES = 1_000_000_000
TEXT_EXTENSIONS = {'.html', '.css', '.js', '.mjs', '.svg', '.txt', '.json', '.xml', '.webmanifest'}
STATIC_EXTENSIONS = TEXT_EXTENSIONS | {
    '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.ico', '.woff', '.woff2', '.ttf', '.otf',
}


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def public_marker(source_commit):
    # Same opaque identity as deploy.sh; never publish the source commit or manifest.
    identity = hashlib.sha256(('mouse.black/site/' + source_commit).encode()).hexdigest()
    return {'release': identity, 'domain': 'mouse.black'}


def manifest():
    path = INFRA / 'downloads.json'
    # Reuse the existing exact three-platform URL/filename/version/size/SHA contract.
    subprocess.run(['bash', str(INFRA / 'deploy.sh'), '--validate-downloads', str(path)], check=True)
    data = json.loads(path.read_text(encoding='utf-8'))
    total = sum(item['size'] for item in data['files'])
    require(total <= MAX_TOTAL_BYTES, 'installers alone exceed the 1,000,000,000-byte Pages limit')
    return data


def public_files(directory, installers):
    """Reject links, private build inputs, unexpected files and oversized artifacts."""
    files = {}
    for path in sorted(directory.rglob('*')):
        relative = path.relative_to(directory)
        name = relative.as_posix()
        require(not path.is_symlink(), 'symlink in artifact: ' + name)
        require(all(not part.startswith('.') for part in relative.parts) or name == '.nojekyll',
                'hidden path in artifact: ' + name)
        require(not {'infra', 'webroot', 'node_modules'}.intersection(relative.parts),
                'nonpublic directory in artifact: ' + name)
        info = path.stat()
        if stat.S_ISDIR(info.st_mode):
            continue
        require(stat.S_ISREG(info.st_mode) and info.st_nlink == 1,
                'nonregular or hardlinked artifact file: ' + name)
        require(not info.st_mode & 0o111, 'executable artifact file: ' + name)
        if relative.parts[0] == 'downloads':
            require(name in installers, 'unexpected download file: ' + name)
        else:
            require(name == '.nojekyll' or path.suffix.lower() in STATIC_EXTENSIONS,
                    'nonstatic artifact file: ' + name)
            require(path.name not in {'downloads.json', 'manifest.json', 'seo-i18n.json'},
                    'private build input in artifact: ' + name)
            require(info.st_size <= 10 * 1024 * 1024, 'oversized static file: ' + name)
            if path.suffix.lower() in TEXT_EXTENSIONS:
                content = path.read_bytes().lower()
                require(b'github.com' not in content and b'githubusercontent.com' not in content,
                        'upstream repository URL in public artifact: ' + name)
        files[name] = info.st_size
    require(sum(files.values()) <= MAX_TOTAL_BYTES, 'artifact exceeds 1,000,000,000 bytes')
    return files


def fetch_installer(item, temporary, downloads):
    target = temporary / (item['filename'] + '.part')
    size_limit = item['size']

    def limit_file_size():
        # Enforce the byte bound even if an upstream omits Content-Length.
        resource.setrlimit(resource.RLIMIT_FSIZE, (size_limit, size_limit))

    command = [
        'curl', '--disable', '--fail', '--silent', '--show-error', '--location',
        '--proto', '=https', '--proto-redir', '=https', '--tlsv1.2', '--max-redirs', '5',
        '--connect-timeout', '20', '--max-time', '240', '--retry', '2',
        '--retry-delay', '3', '--retry-max-time', '480', '--retry-connrefused',
        '--max-filesize', str(size_limit), '--output', str(target), '--', item['url'],
    ]
    # No curl config, credentials, netrc, Authorization header or source token is used.
    try:
        result = subprocess.run(command, timeout=750, preexec_fn=limit_file_size)
    except subprocess.TimeoutExpired as error:
        raise ValueError('installer download timed out: ' + item['filename']) from error
    require(result.returncode == 0, 'installer download failed: ' + item['filename'])
    require(target.is_file() and not target.is_symlink() and target.stat().st_size == size_limit,
            'installer size mismatch: ' + item['filename'])
    digest = hashlib.sha256()
    with target.open('rb') as source:
        for block in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(block)
    require(digest.hexdigest() == item['sha256'], 'installer SHA256 mismatch: ' + item['filename'])
    target.chmod(0o644)
    os.replace(target, downloads / item['filename'])
    print('MOUSE_PAGES_INSTALLER_VERIFIED ' + item['filename'] + ' bytes=' + str(size_limit), flush=True)


def build(output, source_commit, check_only):
    require(re.fullmatch(r'[0-9a-f]{40}', source_commit) is not None, 'a full lowercase source commit is required')
    require(not output.is_symlink(), 'output must not be a symlink')
    output = output.resolve()
    require(not output.exists(), 'output must be a new directory; existing files are never replaced')
    require(output.parent.is_dir(), 'output parent directory must already exist')
    require(not output.is_relative_to(ROOT / 'website'), 'output must not be inside website source')
    data = manifest()
    installer_bytes = sum(item['size'] for item in data['files'])
    installer_names = {'downloads/' + item['filename'] for item in data['files']}
    with tempfile.TemporaryDirectory(prefix='.mouse-pages-build-', dir=output.parent) as work:
        temporary = Path(work)
        stage = temporary / 'site'
        subprocess.run([sys.executable, str(INFRA / 'build-site.py'), '--output', str(stage)], check=True)
        generated = set(json.loads((temporary / 'site.files.json').read_text(encoding='utf-8')))
        (stage / '.nojekyll').write_bytes(b'')
        (stage / 'release.json').write_text(
            json.dumps(public_marker(source_commit), separators=(',', ':')) + '\n', encoding='utf-8')
        expected = generated | {'.nojekyll', 'release.json'}
        files = public_files(stage, installer_names)
        require(set(files) == expected, 'generated artifact contains unexpected or missing files')
        subprocess.run([sys.executable, str(INFRA / 'verify-seo.py'), str(stage)], check=True)
        static_bytes = sum(files.values())
        require(static_bytes + installer_bytes <= MAX_TOTAL_BYTES,
                'static site and installers together exceed 1,000,000,000 bytes')
        if not check_only:
            require(shutil.which('curl') is not None, 'curl is required to fetch installers')
            require(shutil.disk_usage(temporary).free >= static_bytes + installer_bytes + 100 * 1024 * 1024,
                    'not enough disk space for the complete artifact plus 100 MiB reserve')
            downloads = stage / 'downloads'
            downloads.mkdir(mode=0o755)
            for item in data['files']:
                fetch_installer(item, temporary, downloads)
            expected |= installer_names
            files = public_files(stage, installer_names)
            require(set(files) == expected, 'final artifact contains unexpected or missing files')
            require(sum(files.values()) == static_bytes + installer_bytes, 'final artifact size mismatch')
        # The temporary manifest/bookkeeping and partial downloads stay outside the artifact.
        os.replace(stage, output)
    mode = 'PREFLIGHT_OK' if check_only else 'ARTIFACT_READY'
    print('MOUSE_PAGES_' + mode + ' version=' + data['version'] + ' html=73 languages=72' +
          ' files=' + str(len(files)) + ' static_bytes=' + str(static_bytes) +
          ' installer_bytes=' + str(installer_bytes) +
          ' projected_total_bytes=' + str(static_bytes + installer_bytes) +
          ' installers_fetched=' + ('0' if check_only else '3'), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True, help='New output directory with an existing parent')
    parser.add_argument('--source-commit', required=True, help='Full source commit used only to derive an opaque release ID')
    parser.add_argument('--check-only', action='store_true', help='Build and validate static files; do not download installers')
    args = parser.parse_args()
    try:
        build(args.output, args.source_commit, args.check_only)
    except (OSError, ValueError, subprocess.SubprocessError) as error:
        print('MOUSE_PAGES_REJECTED: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
