; Extra NSIS steps, wired in via build.nsis.include (package.json).
; electron-updater caches the downloaded installer.exe (~100 MB) in
; %LOCALAPPDATA%\notepad-flux-updater; remove it on a real uninstall.
; Skipped during an update: the running updater installs FROM that directory.
; User data (AppData\LocalLow\Notepad Flux, %APPDATA%\notepad-flux) is untouched.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    RMDir /r "$LOCALAPPDATA\notepad-flux-updater"
  ${endIf}
!macroend
