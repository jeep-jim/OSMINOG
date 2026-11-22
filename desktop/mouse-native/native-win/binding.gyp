{
  "targets": [{
    "target_name": "mouse_platform",
    "sources": ["../platform-windows.cc", "../pane-corners-windows.cc", "../update-helper-windows.cc"],
    "defines": ["NAPI_VERSION=8", "WIN32_LEAN_AND_MEAN", "NOMINMAX", "_WIN32_WINNT=0x0A00"],
    "libraries": ["user32.lib", "gdi32.lib", "comctl32.lib", "dcomp.lib", "dwmapi.lib"],
    "msvs_settings": {
      "VCCLCompilerTool": {"AdditionalOptions": ["/std:c++17", "/utf-8"], "ExceptionHandling": 1}
    }
  }]
}
