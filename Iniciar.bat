@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Instalando dependencias, aguarde...
  call npm install
)
call npm run build
call npx electron .
pause
