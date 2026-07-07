@echo off
REM ============================================================
REM Instalador silencioso de Node.js LTS para Windows
REM Requiere ejecutar como Administrador
REM ============================================================
setlocal

set "NODE_VERSION=20.18.0"
set "INSTALLER_URL=https://nodejs.org/dist/v%NODE_VERSION%/node-v%NODE_VERSION%-x64.msi"
set "INSTALLER=%TEMP%\node-installer.msi"

echo Descargando Node.js v%NODE_VERSION% LTS...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%INSTALLER_URL%' -OutFile '%INSTALLER%' -UseBasicParsing"
if errorlevel 1 (
  echo ERROR: No se pudo descargar el instalador.
  exit /b 1
)

echo Instalando Node.js (silencioso)...
msiexec /i "%INSTALLER%" /qn ADDLOCAL=ALL
if errorlevel 1 (
  echo ERROR: Fallo la instalacion MSI.
  exit /b 1
)

del "%INSTALLER%" 2>nul
echo Instalacion completada. Reinicia la terminal para usar node/npm/npx.
endlocal