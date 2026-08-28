#define MyAppName "OSMINOG Dev Hub"
#define MyAppVersion "1.1.1"
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
  BootstrapPath: String;

function JsonEscape(Value: String): String;
begin
  Result := Value;
  StringChangeEx(Result, '\', '\\', True);
  StringChangeEx(Result, '"', '\"', True);
end;

function LooksLikeOsminogFolder(Path: String): Boolean;
var
  ManifestPath: String;
  ManifestText: AnsiString;
  ManifestUnicode: String;
begin
  Result := False;
  ManifestPath := AddBackslash(Path) + 'manifest.json';
  if not FileExists(ManifestPath) then exit;
  if not LoadStringFromFile(ManifestPath, ManifestText) then exit;
  ManifestUnicode := ManifestText;
  Result := (Pos(ManifestKey, ManifestUnicode) > 0) and (Pos('"OSMINOG"', ManifestUnicode) > 0);
end;

function FindOsminogOnDesktop(): String;
var
  Root, Candidate: String;
  FindRec: TFindRec;
begin
  Result := '';
  Root := ExpandConstant('{userdesktop}');
  if LooksLikeOsminogFolder(Root) then
  begin
    Result := Root;
    exit;
  end;
  if FindFirst(AddBackslash(Root) + '*', FindRec) then
  begin
    try
      repeat
        if ((FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0) and
           (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          Candidate := AddBackslash(Root) + FindRec.Name;
          if LooksLikeOsminogFolder(Candidate) then
          begin
            Result := Candidate;
            exit;
          end;
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

procedure WriteConfig(InstallDir: String);
var
  ConfigPath, ConfigJson: String;
begin
  ConfigPath := ExpandConstant('{app}\config.json');
  ConfigJson := '{' + #13#10 +
    '  "installDir": "' + JsonEscape(InstallDir) + '",' + #13#10 +
    '  "feedUrl": "' + FeedUrl + '",' + #13#10 +
    '  "versionsDir": "' + JsonEscape(ExpandConstant('{localappdata}\OSMINOG\DevHub\versions')) + '",' + #13#10 +
    '  "workDir": "' + JsonEscape(ExpandConstant('{localappdata}\OSMINOG\DevHub\work')) + '",' + #13#10 +
    '  "maxBackups": 8,' + #13#10 +
    '  "extensionId": "' + ExtensionId + '",' + #13#10 +
    '  "manifestKey": "' + ManifestKey + '"' + #13#10 +
    '}' + #13#10;
  SaveStringToFile(ConfigPath, ConfigJson, False);
end;

function RunBootstrapUpdate(HostExe: String): Boolean;
var
  Ok: Boolean;
begin
  UpdateExitCode := -1;
  Ok := Exec(HostExe, '--update', ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, UpdateExitCode);
  if not Ok then UpdateExitCode := -2;
  Result := Ok and (UpdateExitCode = 0);
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  HostManifestPath, HostExe, HostJson, SelectedDir: String;
begin
  if CurStep = ssPostInstall then
  begin
    HostExe := ExpandConstant('{app}\OsminogUpdaterHost.exe');
    HostManifestPath := ExpandConstant('{app}\com.briefcraft.updater.json');

    HostJson := '{' + #13#10 +
      '  "name": "com.briefcraft.updater",' + #13#10 +
      '  "description": "OSMINOG Dev Hub native update bridge",' + #13#10 +
      '  "path": "' + JsonEscape(HostExe) + '",' + #13#10 +
      '  "type": "stdio",' + #13#10 +
      '  "allowed_origins": ["chrome-extension://' + ExtensionId + '/"]' + #13#10 +
      '}' + #13#10;
    SaveStringToFile(HostManifestPath, HostJson, False);

    BootstrapPath := '';
    WriteConfig('');
    if RunBootstrapUpdate(HostExe) then exit;

    BootstrapPath := FindOsminogOnDesktop();
    if BootstrapPath <> '' then
    begin
      WriteConfig(BootstrapPath);
      if RunBootstrapUpdate(HostExe) then exit;
    end;

    SelectedDir := ExpandConstant('{userdesktop}');
    if BrowseForFolder('Один раз укажите папку расширения OSMINOG, которую Chrome сейчас загружает. Следующие обновления будут работать без выбора папки.', SelectedDir, False) then
    begin
      if LooksLikeOsminogFolder(SelectedDir) then
      begin
        BootstrapPath := SelectedDir;
        WriteConfig(BootstrapPath);
        RunBootstrapUpdate(HostExe);
      end
      else
      begin
        UpdateExitCode := -3;
        MsgBox('В выбранной папке не найден совместимый OSMINOG manifest.json. Папка не была изменена.', mbError, MB_OK);
      end;
    end;
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if CurPageID = wpFinished then
  begin
    if UpdateExitCode = 0 then
      WizardForm.FinishedLabel.Caption :=
        'OSMINOG Dev Hub установлен и текущая папка расширения обновлена.' + #13#10#13#10 +
        'Папка: ' + BootstrapPath + #13#10#13#10 +
        'Сейчас один раз откройте chrome://extensions и нажмите Reload на карточке OSMINOG.' + #13#10 +
        'После этого следующие dev-обновления будут ставиться прямо кнопкой внутри OSMINOG.'
    else
      WizardForm.FinishedLabel.Caption :=
        'OSMINOG Dev Hub установлен, но bootstrap 3.10.6 → 3.10.7 не завершён.' + #13#10#13#10 +
        'Рабочая папка OSMINOG не удалялась. Запустите установщик ещё раз и, если автоматический поиск снова не найдёт её, один раз выберите текущую папку OSMINOG на рабочем столе.';
  end;
end;
