@echo off
echo --- Buscando Node.js en ubicaciones comunes ---
if exist "C:\Program Files\nodejs\node.exe" echo FOUND: C:\Program Files\nodejs
if exist "C:\Program Files (x86)\nodejs\node.exe" echo FOUND: C:\Program Files (x86)\nodejs
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" echo FOUND: %LOCALAPPDATA%\Programs\nodejs
if exist "%APPDATA%\nvm\node.exe" echo FOUND: %APPDATA%\nvm
if exist "C:\tools\nodejs\node.exe" echo FOUND: C:\tools\nodejs
echo --- PATH actual ---
echo %PATH%