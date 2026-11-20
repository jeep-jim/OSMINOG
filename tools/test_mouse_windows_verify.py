import importlib.util
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
            "MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS",
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
        self.assertEqual(baseline, retained | superseded_editing)
        self.assertEqual(len(baseline), len(verify.BASELINE_629_WRITE_MARKERS))
        self.assertTrue(superseded_editing.isdisjoint(required))
        current = {
            "MOUSE_632_DOCUMENTS_VIEW_ONLY_PASS",
            "MOUSE_632_FOOTER_LAYOUT_BOTH_THEMES_PASS",
            "MOUSE_632_WEBSITE_OFFER_NEW_TAB_PASS",
            "MOUSE_633_AGENT_VISIBLE_RESTORE_WITHOUT_AUTOENABLE_PASS",
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
