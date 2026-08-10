@echo off
setlocal
set "APP_ROOT=%~dp0"

if not exist "%APP_ROOT%runtime\node.exe" (
  echo Runtime local nao encontrado. Consulte o arquivo README.txt desta pasta.
  pause
  exit /b 1
)

pushd "%APP_ROOT%agent"
start "DB Compare Agent" /b "%APP_ROOT%runtime\node.exe" --env-file=.env dist\server.js > agent.log 2>&1

for /l %%i in (1,1,10) do (
  curl --silent --fail http://127.0.0.1:38765/health >nul && goto open_site
  timeout /t 1 /nobreak >nul
)

echo.
echo Nao foi possivel iniciar o agente local do DB Compare.
echo Consulte o arquivo: %APP_ROOT%agent\agent.log
type agent.log
pause
exit /b 1

:open_site
popd
start "" https://dbcompare-d1bc2.web.app
