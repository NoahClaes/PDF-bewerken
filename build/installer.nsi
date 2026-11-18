; Installatieprogramma voor PDF Bewerken (per gebruiker, geen beheerdersrechten nodig)
Unicode true
SetCompressor /SOLID lzma
RequestExecutionLevel user

!define APPNAME "PDF Bewerken"
!define EXENAME "PDF Bewerken.exe"
!ifndef VERSION
  !define VERSION "1.0.0"
!endif
!define REGUNINST "Software\Microsoft\Windows\CurrentVersion\Uninstall\PDFBewerken"

Name "${APPNAME}"
OutFile "..\dist\${APPNAME} Setup ${VERSION}.exe"
InstallDir "$LOCALAPPDATA\Programs\${APPNAME}"
InstallDirRegKey HKCU "Software\${APPNAME}" "InstallDir"
BrandingText "${APPNAME} ${VERSION}"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${EXENAME}"
!define MUI_FINISHPAGE_RUN_TEXT "${APPNAME} nu starten"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "Dutch"

VIProductVersion "${VERSION}.0"
VIAddVersionKey /LANG=${LANG_DUTCH} "ProductName" "${APPNAME}"
VIAddVersionKey /LANG=${LANG_DUTCH} "FileDescription" "${APPNAME} installatie"
VIAddVersionKey /LANG=${LANG_DUTCH} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_DUTCH} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_DUTCH} "LegalCopyright" "${APPNAME}"

Function .onInit
  ; draait de app nog? eerst sluiten
  System::Call 'kernel32::CreateMutex(i 0, i 0, t "PDFBewerkenSetupMutex") i .r1 ?e'
FunctionEnd

; na een automatische update (stil, met --relaunch) de app meteen weer starten
Function .onInstSuccess
  ${GetParameters} $R0
  ClearErrors
  ${GetOptions} $R0 "--relaunch" $R1
  ${IfNot} ${Errors}
    Exec '"$INSTDIR\${EXENAME}"'
  ${EndIf}
FunctionEnd

Section "Installeren"
  ; een eventueel open venster sluiten zodat bestanden vervangen kunnen worden
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F'
  SetOutPath "$INSTDIR"
  File /r "..\dist\win-unpacked\*.*"
  WriteUninstaller "$INSTDIR\Verwijderen.exe"

  CreateDirectory "$SMPROGRAMS\${APPNAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"
  CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME} verwijderen.lnk" "$INSTDIR\Verwijderen.exe"
  CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXENAME}"

  WriteRegStr HKCU "Software\${APPNAME}" "InstallDir" "$INSTDIR"
  ; in Windows "Apps en onderdelen"
  WriteRegStr HKCU "${REGUNINST}" "DisplayName" "${APPNAME}"
  WriteRegStr HKCU "${REGUNINST}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${REGUNINST}" "Publisher" "${APPNAME}"
  WriteRegStr HKCU "${REGUNINST}" "DisplayIcon" "$INSTDIR\${EXENAME}"
  WriteRegStr HKCU "${REGUNINST}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${REGUNINST}" "UninstallString" '"$INSTDIR\Verwijderen.exe"'
  WriteRegDWORD HKCU "${REGUNINST}" "NoModify" 1
  WriteRegDWORD HKCU "${REGUNINST}" "NoRepair" 1

  ; "Openen met > PDF Bewerken" voor PDF-bestanden (je standaard PDF-programma blijft hetzelfde)
  WriteRegStr HKCU "Software\Classes\PDFBewerken.pdf" "" "PDF-document"
  WriteRegStr HKCU "Software\Classes\PDFBewerken.pdf\DefaultIcon" "" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "Software\Classes\PDFBewerken.pdf\shell\open\command" "" '"$INSTDIR\${EXENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFBewerken.pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXENAME}\shell\open\command" "" '"$INSTDIR\${EXENAME}" "%1"'
  WriteRegStr HKCU "Software\Classes\Applications\${EXENAME}\SupportedTypes" ".pdf" ""
  WriteRegStr HKCU "Software\Classes\Applications\${EXENAME}" "FriendlyAppName" "${APPNAME}"
  ; "Bewerken met PDF Bewerken" in het rechtermuismenu van een PDF
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\PDFBewerken" "" "Bewerken met ${APPNAME}"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\PDFBewerken" "Icon" "$INSTDIR\${EXENAME},0"
  WriteRegStr HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\PDFBewerken\command" "" '"$INSTDIR\${EXENAME}" "%1"'
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /IM "${EXENAME}" /F'
  Delete "$DESKTOP\${APPNAME}.lnk"
  RMDir /r "$SMPROGRAMS\${APPNAME}"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${REGUNINST}"
  DeleteRegKey HKCU "Software\${APPNAME}"
  DeleteRegKey HKCU "Software\Classes\PDFBewerken.pdf"
  DeleteRegValue HKCU "Software\Classes\.pdf\OpenWithProgids" "PDFBewerken.pdf"
  DeleteRegKey HKCU "Software\Classes\Applications\${EXENAME}"
  DeleteRegKey HKCU "Software\Classes\SystemFileAssociations\.pdf\shell\PDFBewerken"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'
  ; je bewaarde bestanden en lettertypes (in %APPDATA%\PDF Bewerken) blijven staan
SectionEnd
