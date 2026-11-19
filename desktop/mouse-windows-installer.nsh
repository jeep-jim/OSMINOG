# Mouse's full Windows runtime needs the ConPTY support used by node-pty.
# Windows 10 1903 (18362) is the first stable release above its 18309 guard.
# Electron 44 also requires Windows 10 or later. Use real version queries so
# compatibility manifests cannot make an unsupported system appear supported.
!define MOUSE_MIN_WINDOWS_BUILD 18362

!macro preInit
  !ifndef BUILD_UNINSTALLER
    Push $R0
    Push $R1
    Push $R2
    Push $R3
    ${StdUtils.GetRealOSVersion} $R0 $R1 $R2
    ${StdUtils.GetRealOSBuildNo} $R3
    IntCmp $R0 10 mouse_windows_check_build mouse_windows_unsupported mouse_windows_check_build
    mouse_windows_check_build:
    IntCmp $R3 ${MOUSE_MIN_WINDOWS_BUILD} mouse_windows_supported mouse_windows_unsupported mouse_windows_supported
    mouse_windows_unsupported:
    MessageBox MB_OK|MB_ICONSTOP "Mouse Browser requires 64-bit Windows 10 version 1903 (build 18362) or later, or Windows 11. Setup has been cancelled." /SD IDOK
    SetErrorLevel 1633
    Quit
    mouse_windows_supported:
    Pop $R3
    Pop $R2
    Pop $R1
    Pop $R0
  !endif
!macroend
