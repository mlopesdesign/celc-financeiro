Unicode true
RequestExecutionLevel user
SetCompressor /SOLID zlib
ManifestDPIAware true

!define APP_NAME "CELC Financeiro"
!define APP_VERSION "0.2.3"
!define APP_PUBLISHER "ML Lopes Design"
!define APP_EXE "CELC Financeiro.exe"
!define APP_REGKEY "Software\\ML Lopes Design\\CELC Financeiro"
!define UNINSTALL_KEY "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CELC Financeiro"

Name "${APP_NAME} ${APP_VERSION}"
OutFile "..\\Release\\CELC-Financeiro-Setup-0.2.3.exe"
VIProductVersion "0.2.3.0"
VIAddVersionKey "ProductName" "CELC Financeiro"
VIAddVersionKey "ProductVersion" "0.2.3"
VIAddVersionKey "CompanyName" "ML Lopes Design"
VIAddVersionKey "LegalCopyright" "© 2026 ML Lopes Design"
VIAddVersionKey "FileDescription" "Instalador do CELC Financeiro"
VIAddVersionKey "FileVersion" "0.2.3"
VIAddVersionKey "OriginalFilename" "CELC-Financeiro-Setup-0.2.3.exe"
Icon "..\assets\celc-app-icon.ico"
UninstallIcon "..\assets\celc-app-icon.ico"
InstallDir "$LOCALAPPDATA\\Programs\\CELC Financeiro"
InstallDirRegKey HKCU "${APP_REGKEY}" "InstallDir"
BrandingText "Colégio CELC · Gestão financeira"
ShowInstDetails show
ShowUninstDetails show

!include "MUI2.nsh"
!include "LogicLib.nsh"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_RUN "$INSTDIR\\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir CELC Financeiro"
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

Function .onInit
  ReadRegStr $0 HKCU "${APP_REGKEY}" "Version"
  ReadRegStr $1 HKCU "${APP_REGKEY}" "InstallDir"
  ${If} $0 != ""
  ${AndIf} $1 != ""
    MessageBox MB_ICONINFORMATION|MB_OK "Versão anterior $0 do CELC Financeiro foi reconhecida.$\r$\n$\r$\nA instalação será atualizada sem remover os dados, backups ou credenciais em %APPDATA%\\CELC Financeiro."
    StrCpy $INSTDIR $1
  ${EndIf}
FunctionEnd

Section "CELC Financeiro" SEC_APP
  SetOutPath "$INSTDIR"
  File /oname=CELC_Financeiro.exe "..\\dist\\CELC Financeiro\\CELC Financeiro-win_x64.exe"
  Rename "$INSTDIR\\CELC_Financeiro.exe" "$INSTDIR\\${APP_EXE}"
  File "..\\dist\\CELC Financeiro\\resources.neu"
  File /oname=celc-app-icon.ico "..\\assets\\celc-app-icon.ico"
  InitPluginsDir
  SetOutPath "$PLUGINSDIR"
  File /oname=MicrosoftEdgeWebView2RuntimeInstallerX64.exe "..\\tools\\release\\MicrosoftEdgeWebView2RuntimeInstallerX64.exe"
  DetailPrint "Preparando o componente Microsoft WebView2 para uso offline..."
  ExecWait '"$PLUGINSDIR\\MicrosoftEdgeWebView2RuntimeInstallerX64.exe" /silent /install' $0
  SetOutPath "$INSTDIR"
  WriteUninstaller "$INSTDIR\\Desinstalar CELC Financeiro.exe"
  WriteRegStr HKCU "${APP_REGKEY}" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${APP_REGKEY}" "Version" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\\celc-app-icon.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\\Desinstalar CELC Financeiro.exe"'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1
  CreateDirectory "$SMPROGRAMS\\CELC Financeiro"
  CreateShortcut "$SMPROGRAMS\\CELC Financeiro\\CELC Financeiro.lnk" "$INSTDIR\\${APP_EXE}" "" "$INSTDIR\\celc-app-icon.ico" 0
  CreateShortcut "$DESKTOP\\CELC Financeiro.lnk" "$INSTDIR\\${APP_EXE}" "" "$INSTDIR\\celc-app-icon.ico" 0
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\\CELC Financeiro.lnk"
  Delete "$SMPROGRAMS\\CELC Financeiro\\CELC Financeiro.lnk"
  RMDir "$SMPROGRAMS\\CELC Financeiro"
  Delete "$INSTDIR\\Desinstalar CELC Financeiro.exe"
  Delete "$INSTDIR\\${APP_EXE}"
  Delete "$INSTDIR\\resources.neu"
  Delete "$INSTDIR\\celc-app-icon.ico"
  RMDir /r "$INSTDIR\\resources"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"
  DeleteRegKey HKCU "${APP_REGKEY}"
  MessageBox MB_ICONINFORMATION|MB_OK "O programa foi removido. Seus dados e backups permanecem protegidos em %APPDATA%\\CELC Financeiro."
SectionEnd
