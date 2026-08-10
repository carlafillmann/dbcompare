@echo off
setlocal
title Agente DBCompare
color 0B
set "APP_ROOT=%~dp0"

echo.
echo ========================================
echo            AGENTE DBCOMPARE
echo ========================================
echo Iniciando o agente local...

if not exist "%APP_ROOT%runtime\node.exe" (
  echo Runtime local nao encontrado. Consulte o arquivo README.txt desta pasta.
  pause
  exit /b 1
)

pushd "%APP_ROOT%agent"
start "DB Compare Agent" /b "%APP_ROOT%runtime\node.exe" --env-file=.env dist\server.js

for /l %%i in (1,1,10) do (
  echo Verificando disponibilidade do agente (tentativa %%i de 10)...
  curl --silent --fail http://127.0.0.1:38765/health >nul && goto open_site
  timeout /t 1 /nobreak >nul
)

echo.
echo Nao foi possivel iniciar o agente local do DB Compare.
echo Verifique as mensagens exibidas nesta janela.
pause
exit /b 1

:open_site
popd
echo.
echo Agente pronto. Abrindo o DB Compare no navegador...
start "" https://dbcompare-d1bc2.web.app
echo.
echo O agente continuara ativo enquanto esta janela permanecer aberta.
echo Os registros de atividade aparecerao abaixo.
echo.

:monitor
timeout /t 60 /nobreak >nul
goto monitor
