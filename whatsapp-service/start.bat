@echo off
title WhatsApp Service (Whatsmeow Go)
echo ==============================================
echo  Iniciando Servico WhatsApp (Whatsmeow Go)
echo  Porta: 5001
echo ==============================================

set "PATH=%USERPROFILE%\go\bin;%PATH%"
cd /d "%~dp0"

echo Baixando dependencias e iniciando...
go run .

pause
