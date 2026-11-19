import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest


spec = importlib.util.spec_from_file_location("mouse_windows_verify", Path(__file__).with_name("mouse-windows-verify.py"))
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


class WindowsVerificationContracts(unittest.TestCase):
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
        for marker in ("MOUSE_625_DOCUMENTS_NATIVE_EDIT_SAVE_PRESERVE_PASS",
                       "MOUSE_627_PDF_EXISTING_TEXT_NATIVE_PASS",
                       "MOUSE_629_UI_REGRESSIONS_NATIVE_PASS",
                       "MOUSE_628_PER_PANE_PROGRESS_NATIVE_PASS",
                       "MOUSE_629_TWO_FINGER_WHEEL_TUTORIAL_WRITE_PASS",
                       "MOUSE_WINDOWS_AGENT_PTY_LOCAL_MCP_PASS",
                       "MOUSE_WINDOWS_PRIVATE_MEMORY_ISOLATION_PASS"):
            self.assertIn(marker, required)
        self.assertEqual(len(required), len(verify.WRITE_MARKERS))


if __name__ == "__main__":
    unittest.main()
