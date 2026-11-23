import importlib.util
import hashlib
import io
import json
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


spec = importlib.util.spec_from_file_location("mouse_windows_verify", Path(__file__).with_name("mouse-windows-verify.py"))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class WindowsVerificationContracts(unittest.TestCase):
    def test_display_preparation_uses_two_exited_processes_and_binds_receipt(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            calls = []
            def run(args, env, log, timeout):
                calls.append(args)
                self.assertIsNone(timeout, 'Only the unchanged overall workflow deadline bounds these commands')
                phase = 'verify' if '-Verify' in args else 'prepare'
                marker = 'MOUSE_637_WINDOWS_DISPLAY_' + ('PERSISTENCE_PASS' if phase == 'verify' else 'PREPARED')
                pid = 102 if phase == 'verify' else 101
                log.write_text(marker + '\n', encoding='utf-8')
                receipt = {'ok': True, 'version': '6.0.38', 'platform': 'win32', 'pid': 101}
                if phase == 'verify':
                    receipt.update(processExitVerified=True, persistence={'pid': pid})
                (output / 'mouse-637-display.json').write_text(json.dumps(receipt), encoding='utf-8')
                return {'pid': pid, 'exitCode': 0, 'startedAtMs': pid, 'finishedAtMs': pid + .5,
                        'elapsedMs': 1, 'log': log.name, 'output': marker + '\n'}
            with mock.patch.object(verify, 'run_logged', side_effect=run):
                result = verify.prepare_current_display({'CI': 'true'}, output)
            self.assertEqual(len(calls), 2)
            self.assertEqual(calls[0][:3], ['pwsh', '-NoProfile', '-File'])
            self.assertNotIn('-Verify', calls[0])
            self.assertIn('-Verify', calls[1])
            self.assertEqual(result['prepare']['pid'], 101)
            self.assertEqual(result['verify']['pid'], 102)
            self.assertEqual(result['reportSha256'], verify.sha256(output / 'mouse-637-display.json'))

    def test_display_failure_never_runs_the_second_process(self):
        with tempfile.TemporaryDirectory() as directory:
            with mock.patch.object(verify, 'run_logged', side_effect=RuntimeError('native prepare failed')) as run:
                with self.assertRaisesRegex(RuntimeError, 'native prepare failed'):
                    verify.prepare_current_display({'CI': 'true'}, Path(directory))
            self.assertEqual(run.call_count, 1)

    def test_complete_legacy_and_both_display_processes_are_required_before_baseline(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installer = root / 'candidate.exe'
            installer.write_bytes(b'unit fixture only')
            for failed in ('legacy', 'display'):
                with self.subTest(failed=failed), mock.patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': directory}), \
                        mock.patch.object(verify, 'user32'), \
                        mock.patch.object(verify, 'version_upgrade', side_effect=RuntimeError('legacy failure') if failed == 'legacy' else None, return_value={'ok': True}) as legacy, \
                        mock.patch.object(verify, 'prepare_current_display', side_effect=RuntimeError('display failure')) as display, \
                        mock.patch.object(verify, 'run_logged') as current:
                    with self.assertRaisesRegex(RuntimeError, failed + ' failure'):
                        verify.main([str(installer), '--output', str(root / failed)])
                    legacy.assert_called_once()
                    self.assertEqual(display.call_count, 0 if failed == 'legacy' else 1)
                    current.assert_not_called()

    def test_current_baseline_is_first_after_successful_legacy_and_display(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installer = root / 'candidate.exe'
            installer.write_bytes(b'unit fixture only')
            order = []
            def legacy(*_args):
                order.append('complete legacy WRITE replacement READ')
                return {'ok': True}
            def display(*_args):
                order.append('prepare then independent verify')
                return {'ok': True}
            def baseline(args, *_args):
                order.append(Path(args[1]).name)
                raise RuntimeError('stop after observing baseline invocation')
            with mock.patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': directory}), mock.patch.object(verify, 'user32'), \
                    mock.patch.object(verify, 'version_upgrade', side_effect=legacy), \
                    mock.patch.object(verify, 'prepare_current_display', side_effect=display), \
                    mock.patch.object(verify, 'run_logged', side_effect=baseline):
                with self.assertRaisesRegex(RuntimeError, 'observing baseline'):
                    verify.main([str(installer), '--output', str(root / 'output')])
            self.assertEqual(order, ['complete legacy WRITE replacement READ', 'prepare then independent verify', 'mouse-637-baseline-performance.py'])

    def test_feature_reports_survive_later_failure_and_final_wrapper_save(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installer = root / 'candidate.exe'
            installer.write_bytes(b'unit fixture only')
            output = root / 'output'
            output.mkdir()
            for name in ('mouse-637-baseline-performance', 'mouse-637-update-button', 'mouse-637-upgrade',
                         'mouse-636-retained-owner-feedback', 'mouse-633-owner-feedback', 'mouse-631-native',
                         'mouse-631-task', 'mouse-631-stress', 'mouse-632-media', 'mouse-636-owner-feedback'):
                (output / (name + '.json')).write_bytes(b'{"unitFixtureOnly":true}\n')
            written = {'schema': 1, 'version': verify.VERSION, 'pid': 1072, 'writePid': 1072,
                       'phase': 'write', 'ok': False, 'restored': False, 'fixture': 'Сохранённые байты'}
            completed = {**written, 'phase': 'complete', 'ok': True, 'restored': True, 'restart': {'pid': 2904}}
            raw_write = (json.dumps(written, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
            raw_read = (json.dumps(completed, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
            markers = {
                'mouse-637-baseline-performance.log': ['MOUSE_637_BASELINE_PERFORMANCE_PASS'],
                'mouse-637-update-button.log': ['MOUSE_638_REAL_637_TO_638_UPDATE_BUTTON_PASS'],
                'mouse-637-upgrade.log': ['MOUSE_638_REAL_637_TO_638_PROFILE_PASS'],
                'mouse-636-retained-owner-feedback.log': ['MOUSE_636_RETAINED_OWNER_FEEDBACK_PASS'],
                'mouse-633-owner-feedback.log': ['MOUSE_633_OWNER_FEEDBACK_PASS'],
                'mouse-631-native.log': ['MOUSE_631_TASK_ONLY_NATIVE_PASS', 'MOUSE_631_FIFTY_TABS_FIVE_DESKTOPS_NATIVE_PASS',
                                         'MOUSE_631_INSTALLED_TASK_STRESS_PASS', 'MOUSE_632_STATIONARY_MEDIA_PASS'],
                'mouse-636-owner-feedback.log': ['MOUSE_635_LIBRARY_STABLE_PASS', 'MOUSE_637_AGENT_REMOVAL_PASS',
                                                'MOUSE_636_PINNED_PANES_PASS', 'MOUSE_636_SEARCH_REMOVAL_PASS',
                                                'MOUSE_637_PERFORMANCE_PASS', 'MOUSE_636_OWNER_FEEDBACK_PASS'],
                'mouse-637-features-write.log': ['MOUSE_637_FEATURES_WRITE_PASS'],
                'mouse-637-features-read.log': ['MOUSE_637_FEATURES_NATIVE_PASS'],
            }
            before_failure = {}
            def run(args, env, log, timeout):
                if log.name == 'mouse-windows-smoke-write.log':
                    before_failure['feature'] = (output / 'mouse-637-features.json').read_bytes()
                    before_failure['wrapper'] = json.loads((output / 'mouse-windows-verification.json').read_bytes())
                    raise RuntimeError('retained native write failed after completed features')
                pid = 1000
                if log.name == 'mouse-637-features-write.log':
                    (output / 'mouse-637-features.json').write_bytes(raw_write)
                    pid = written['pid']
                elif log.name == 'mouse-637-features-read.log':
                    (output / 'mouse-637-features.json').write_bytes(raw_read)
                    pid = completed['restart']['pid']
                text = '\n'.join(markers[log.name]) + '\n'
                log.write_text(text, encoding='utf-8')
                return {'pid': pid, 'exitCode': 0, 'elapsedMs': 1, 'log': log.name, 'output': text}
            with mock.patch.dict(os.environ, {'CI': 'true', 'RUNNER_TEMP': directory}), \
                    mock.patch.object(verify, 'user32'), \
                    mock.patch.object(verify, 'version_upgrade', return_value={'ok': True}), \
                    mock.patch.object(verify, 'prepare_current_display', return_value={'ok': True}), \
                    mock.patch.object(verify, 'install', return_value={'pid': 999, 'exitCode': 0}), \
                    mock.patch.object(verify, 'feedback638', return_value={'unitFixtureOnly': True}), \
                    mock.patch.object(verify, 'run_logged', side_effect=run), \
                    mock.patch.object(verify.subprocess, 'run'):
                with self.assertRaisesRegex(RuntimeError, 'retained native write failed'):
                    verify.main([str(installer), '--output', str(output)])
            self.assertEqual(before_failure['feature'], raw_read)
            final = json.loads((output / 'mouse-windows-verification.json').read_bytes())
            self.assertFalse(final['ok'])
            self.assertEqual(final['error']['message'], 'retained native write failed after completed features')
            self.assertNotIn('error', before_failure['wrapper'])
            self.assertEqual(final['checks']['features637'], before_failure['wrapper']['checks']['features637'])
            for phase, raw, filename, pid in (('write', raw_write, 'mouse-637-features-write.json', 1072),
                                            ('read', raw_read, 'mouse-637-features.json', 2904)):
                self.assertEqual((output / filename).read_bytes(), raw)
                process = final['checks']['features637'][phase]
                self.assertEqual((process['pid'], process['report']), (pid, filename))
                self.assertEqual(process['reportSha256'], hashlib.sha256(raw).hexdigest())
            self.assertEqual(final['checks']['features637']['reportSha256'], hashlib.sha256(raw_read).hexdigest())

    def test_signature_measurement_preserves_native_errors_and_reads_utf8_file(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "Mouse Browser.exe"
            executable.write_bytes(b"owned package")
            failed = subprocess.CompletedProcess([], 1, stdout="", stderr="ACTUAL_NATIVE_SIGNATURE_ERROR")
            with mock.patch.object(verify.subprocess, "run", return_value=failed):
                with self.assertRaisesRegex(RuntimeError, "ACTUAL_NATIVE_SIGNATURE_ERROR"):
                    verify.authenticode(executable, {})

            def measure(args, **options):
                self.assertIn("-EncodedCommand", args)
                self.assertNotIn("psmodulepath", {key.casefold() for key in options["env"]})
                self.assertEqual(options["env"]["KEEP_NATIVE_ENV"], "preserved")
                self.assertEqual(options["env"]["MOUSE_WINDOWS_AUTHENTICODE_FILE"], str(executable))
                Path(options["env"]["MOUSE_WINDOWS_AUTHENTICODE_RESULT"]).write_text(json.dumps({"status": "NotSigned", "signerSubject": None, "signerThumbprint": None}), encoding="utf-8-sig")
                return subprocess.CompletedProcess(args, 0, stdout="", stderr="")

            with mock.patch.object(verify.subprocess, "run", side_effect=measure):
                result = verify.authenticode(executable, {"PSModulePath": r"C:\PowerShell7\Modules", "pSMoDuLePaTh": r"C:\WrongModules", "KEEP_NATIVE_ENV": "preserved"})
            self.assertEqual(result["status"], "NotSigned")
            self.assertEqual(result["sha256"], verify.sha256(executable))

    @unittest.skipUnless(sys.platform == "win32", "Requires actual Windows Authenticode")
    def test_native_signature_measurement_ignores_inherited_powershell_module_path(self):
        with tempfile.TemporaryDirectory(prefix="mouse-signature-test-") as directory:
            file = Path(directory) / "Unsigned fixture.ps1"
            file.write_text("# Owned unsigned fixture; never executed.\n", encoding="utf-8")
            result = verify.authenticode(file, {**os.environ, "PSModulePath": str(Path(directory) / "missing-PS7-modules")})
            self.assertEqual(result["status"], "NotSigned")
            self.assertIsNone(result["signerSubject"])
            self.assertIsNone(result["signerThumbprint"])
            self.assertEqual(result["sha256"], verify.sha256(file))

    def test_unicode_diagnostics_survive_windows_ansi_stdout(self):
        buffer = io.BytesIO()
        stream = io.TextIOWrapper(buffer, encoding="cp1252")
        with mock.patch.object(verify.sys, "stdout", stream), mock.patch.object(verify.sys, "stderr", stream), mock.patch.object(verify, "native_input", side_effect=lambda *_: print("Проверка Mouse Browser")):
            self.assertEqual(verify.main(["--input", "key", "ESC"]), 0)
        stream.flush()
        self.assertEqual(buffer.getvalue().decode("utf-8").strip(), "Проверка Mouse Browser")

    def test_real_pe_machine_does_not_trust_filename_or_installer(self):
        with tempfile.TemporaryDirectory() as directory:
            executable = Path(directory) / "Mouse Browser.exe"
            header = bytearray(64)
            header[:2] = b"MZ"
            struct.pack_into("<I", header, 60, 64)
            for machine in (0x8664, 0x014C, 0xAA64):
                executable.write_bytes(header + b"PE\0\0" + struct.pack("<H", machine))
                self.assertEqual(verify.pe_machine(executable), machine)
            executable.write_bytes(b"Mouse Browser Windows x64")
            with self.assertRaisesRegex(RuntimeError, "PE header"):
                verify.pe_machine(executable)
            struct.pack_into("<I", header, 60, 1000000)
            executable.write_bytes(header + b"PE\0\0\x64\x86")
            with self.assertRaisesRegex(RuntimeError, "PE offset"):
                verify.pe_machine(executable)

    def test_markers_require_success_lines_not_quoted_failure_text(self):
        required = ["MOUSE_WINDOWS_X64_SMOKE_PASS", "MOUSE_WINDOWS_PROFILE_WRITE_PASS"]
        with self.assertRaisesRegex(RuntimeError, "Missing acceptance"):
            verify.verify_markers('AssertionError: expected MOUSE_WINDOWS_X64_SMOKE_PASS\n{"message":"MOUSE_WINDOWS_PROFILE_WRITE_PASS"}', required)
        verify.verify_markers("MOUSE_WINDOWS_X64_SMOKE_PASS\nMOUSE_WINDOWS_PROFILE_WRITE_PASS {\"ok\":true}\n", required)

    def test_new_window_must_belong_to_existing_exact_installed_executable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            installed = root / "Mouse Browser.exe"
            installed.write_bytes(b"owned installer output")
            unrelated = root / "other" / installed.name
            unrelated.parent.mkdir()
            unrelated.write_bytes(installed.read_bytes())
            self.assertTrue(verify.same_executable_path(str(installed), installed))
            self.assertFalse(verify.same_executable_path(str(unrelated), installed))
            self.assertFalse(verify.same_executable_path(None, installed))
            installed.unlink()
            self.assertFalse(verify.same_executable_path(str(installed), installed))

    def test_complete_write_contract_retains_substantive_existing_native_gates(self):
        required = set(verify.WRITE_MARKERS)
        baseline = set(verify.BASELINE_629_WRITE_MARKERS)
        retained = {
            "MOUSE_WINDOWS_NATIVE_PAGES_NAVIGATION_PASS",
            "MOUSE_WINDOWS_FIVE_DESKTOPS_IDENTITY_PASS",
            "MOUSE_WINDOWS_CTRL_A_CAPTURE_SHORTCUT_PASS",
            "MOUSE_WINDOWS_NATIVE_WINDOW_CONTROLS_PASS",
            "MOUSE_625_SEARCH_ENGINE_NORMAL_PRIVATE_PASS",
            "MOUSE_627_NATIVE_METADATA_WORKLOAD_PRESERVES_LIVE_PAGES_PASS",
            "MOUSE_628_PER_PANE_PROGRESS_NATIVE_PASS",
            "MOUSE_629_UI_REGRESSIONS_NATIVE_PASS",
            "MOUSE_628_BORDERLESS_NATIVE_PASS",
            "MOUSE_628_NORA_CONTENT_FIT_NATIVE_PASS",
            "MOUSE_626_CAPTURE_ANY_COLOR_PASS",
            "MOUSE_628_OPEN_NORA_DESKTOP_SLIDE_NATIVE_PASS",
            "MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_WRITE_PASS",
            "MOUSE_WINDOWS_PRIVATE_MEMORY_ISOLATION_PASS",
            "MOUSE_WINDOWS_PROFILE_WRITE_PASS",
            "MOUSE_WINDOWS_X64_SMOKE_PASS",
            "MOUSE_WINDOWS_NATIVE_CLOSE_REQUESTED",
        }
        superseded_editing = {
            "MOUSE_625_DOCUMENTS_NATIVE_EDIT_SAVE_PRESERVE_PASS",
            "MOUSE_627_DOCUMENT_TABS_NATIVE_PASS",
            "MOUSE_627_PDF_EXISTING_TEXT_NATIVE_PASS",
        }
        # The actual published629 upgrade fixture retains its original editor gates.
        self.assertEqual(baseline, retained | superseded_editing | {"MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS"})
        self.assertEqual(len(baseline), len(verify.BASELINE_629_WRITE_MARKERS))
        self.assertTrue(superseded_editing.isdisjoint(required))
        self.assertNotIn("MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS", required)
        current = {
            "MOUSE_632_DOCUMENTS_VIEW_ONLY_PASS",
            "MOUSE_632_FOOTER_LAYOUT_BOTH_THEMES_PASS",
            "MOUSE_632_WEBSITE_OFFER_NEW_TAB_PASS",
            "MOUSE_630_DOWNLOAD_ACTIVITY_PASS",
            "MOUSE_630_CAPTURE_FEEDBACK_PASS",
            "MOUSE_630_NORA_NATIVE_FOREGROUND_PASS",
            "MOUSE_630_NATIVE_WHEEL_DESKTOPS_PASS",
            "MOUSE_630_PAGE_SCROLL_PRESERVED_PASS",
            "MOUSE_630_PRIVATE_DOWNLOAD_SCOPE_PASS",
        }
        self.assertEqual(required, retained | current)
        self.assertEqual(len(required), len(verify.WRITE_MARKERS))


if __name__ == "__main__":
    unittest.main()
