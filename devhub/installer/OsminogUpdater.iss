#define MyAppName "OSMINOG Dev Hub"
#define MyAppVersion "1.1.0"
#define MyAppPublisher "OSMINOG"
#define MyAppExeName "OsminogUpdaterHost.exe"

[Setup]
AppId={{AE7EA7C4-9FBC-4CB2-B4D4-6E004FCF5801}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={localappdata}\OSMINOG\DevHub
DisableDirPage=yes
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=output
OutputBaseFilename=OSMINOG-Dev-Hub-Setup
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
Uninstallable=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible

[Files]
Source: "..\UpdaterHost\bin\Release\net8.0\win-x64\publish\OsminogUpdaterHost.exe"; DestDir: "{app}"; Flags: ignoreversion

[Registry]
Root: HKCU; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.briefcraft.updater"; ValueType: string; ValueName: ""; ValueData: "{app}\com.briefcraft.updater.json"; Flags: uninsdeletekey
Root: HKCU32; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.briefcraft.updater"; ValueType: string; ValueName: ""; ValueData: "{app}\com.briefcraft.updater.json"; Flags: uninsdeletekey
Root: HKCU64; Subkey: "Software\Google\Chrome\NativeMessagingHosts\com.briefcraft.updater"; ValueType: string; ValueName: ""; ValueData: "{app}\com.briefcraft.updater.json"; Flags: uninsdeletekey; Check: IsWin64

[Code]
const
  ExtensionId = 'hfckimbjiahikihjoceoegilaiolmkgk';
  ManifestKey = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAstI7PnHbheHLtFKZ+3khPxma+9VesIOBxZc8mu7VuJE8ahUos0draXfHzjy3F1j/42qXKTl+UgagUEO0sj4MYlKyGPpmD6gLBMKyrItP4Qd6PeowtMcyopOVDUUjZNkCa07B9JQ45xwCd3RaDiS1H+io4uOFEAkKrYdbcyUa8ytbJ1EKS4oMiRvyqJjn3T9GuHA7arMpFRwbyBuE/CNchDQ/hjW7LajfOkzS837twTybFGUp+tQHLbHKH3BMjwDmMKOis09DmAVTy2WH5OINqdq9WC+cgJxV2SQQdCZUK1bZ79/RaQzIsAIFN1w0AF0cme1DYF5+xQY8WHWpMGPXfQIDAQAB';
  FeedUrl = 'https://raw.githubusercontent.com/jeep-jim/chernogram_new/briefcraft-releases/osminog/channels/dev/chrome-extension.json';
var
  UpdateExitCode: Integer;

function JsonEscape(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ConfigPath, HostManifestPath, HostExe, ConfigJson, HostJson: String;
  Ok: Boolean;
begin
  if CurStep = ssPostInstall then
  begin
    HostExe := ExpandConstant('{app}\OsminogUpdaterHost.exe');
    ConfigPath := ExpandConstant('{app}\config.json');
    HostManifestPath := ExpandConstant('{app}\com.briefcraft.updater.json');

    ConfigJson := '{' + #13#10 +
      '  "installDir": "",' + #13#10 +
      '  "feedUrl": "' + FeedUrl + '",' + #13#10 +
      '  "versionsDir": "' + JsonEscape(ExpandConstant('{localappdata}\OSMINOG\DevHub\versions')) + '",' + #13#10 +
      '  "workDir": "' + JsonEscape(ExpandConstant('{localappdata}\OSMINOG\DevHub\work')) + '",' + #13#10 +
      '  "maxBackups": 8,' + #13#10 +
      '  "extensionId": "' + ExtensionId + '",' + #13#10 +
      '  "manifestKey": "' + ManifestKey + '"' + #13#10 +
      '}' + #13#10;

    HostJson := '{' + #13#10 +
      '  "name": "com.briefcraft.updater",' + #13#10 +
      '  "description": "OSMINOG Dev Hub native update bridge",' + #13#10 +
      '  "path": "' + JsonEscape(HostExe) + '",' + #13#10 +
      '  "type": "stdio",' + #13#10 +
      '  "allowed_origins": ["chrome-extension://' + ExtensionId + '/"]' + #13#10 +
      '}' + #13#10;

    SaveStringToFile(ConfigPath, ConfigJson, False);
    SaveStringToFile(HostManifestPath, HostJson, False);

    UpdateExitCode := -1;
    Ok := Exec(HostExe, '--update', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, UpdateExitCode);
    if not Ok then UpdateExitCode := -2;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    if UpdateExitCode = 0 then
      WizardForm.FinishedLabel.Caption :=
        'OSMINOG Dev Hub установлен и текущая папка расширения обновлена.' + #13#10#13#10 +
        'Сейчас один раз откройте chrome://extensions и нажмите Reload на карточке OSMINOG.' + #13#10 +
        'После этого следующие dev-обновления будут ставиться прямо кнопкой внутри OSMINOG.'
    else
      WizardForm.FinishedLabel.Caption :=
        'OSMINOG Dev Hub установлен, но автоматический bootstrap не смог определить текущую папку расширения.' + #13#10#13#10 +
        'Не удаляйте OSMINOG. Убедитесь, что расширение включено в Chrome, затем запустите этот установщик ещё раз.';
  end;
end;
