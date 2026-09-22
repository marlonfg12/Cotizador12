@echo off
title Cotizador - Deposito de Flejes San Martin
cd /d "%~dp0"

echo ==============================================================
echo   INICIANDO COTIZADOR - DEPOSITO DE FLEJES SAN MARTIN
echo ==============================================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en este equipo.
  echo Por favor descargue e instale Node.js LTS desde: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando librerias y dependencias necesarias por primera vez...
  call npm install --no-audit --no-fund
  echo.
)

echo Iniciando servidor en el puerto 3000...
echo.

:: Abre la aplicacion localmente
start "" http://localhost:3000

:: Ejecuta el servidor Node.js exponiendo en toda la red local (0.0.0.0)
node server.js

pause
