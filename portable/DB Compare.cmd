@echo off
setlocal
set "APP_ROOT=%~dp0"

if not exist "%APP_ROOT%runtime\node.exe" (
  echo Runtime local nao encontrado. Consulte o arquivo README.txt desta pasta.
  pause
  exit /b 1
)

start "DB Compare" /D "%APP_ROOT%agent" "%APP_ROOT%runtime\node.exe" --env-file=.env dist\server.js
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:38765
