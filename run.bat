@echo off
REM ============================================================
REM Sky Watch - Arranca la app via fuser.studio
REM Uso: ejecutar run.bat
REM ============================================================
setlocal

cd /d "%~dp0\app"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js no esta instalado.
  echo Ejecuta install_node.bat como Administrador y reinicia la terminal.
  exit /b 1
)

echo Iniciando Sky Watch con fuser.studio...
npx --yes fuser.studio@latest run --tunnel
endlocal