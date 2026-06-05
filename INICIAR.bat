@echo off
title HR Operations Management System
color 0A
echo.
echo  ========================================
echo   HR Operations Management System
echo   Starting...
echo  ========================================
echo.

cd /d "%~dp0"

REM Instalar dependencias si es necesario
echo [1/3] Verificando dependencias...
pip install -r requirements.txt -q 2>nul

REM Seed data
echo [2/3] Verificando base de datos...
python -m backend.scripts.seed_data

REM Iniciar servidor
echo [3/3] Iniciando servidor...
echo.
echo  ========================================
echo   Sistema listo en: http://localhost:9050
echo   Presione Ctrl+C para detener
echo  ========================================
echo.

start "" "http://localhost:9050"
python -m uvicorn backend.main:app --host 0.0.0.0 --port 9050 --reload
