@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Spark Vault Dev Server

echo ============================================
echo   Spark Vault Dev Server
echo ============================================
echo.

rem ---- check port 5173 ----
netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo  [Info] Port 5173 already in use, server may be running.
    echo.
    echo  Opening browser...
    start http://localhost:5173/
    echo.
    set SKIP_DEV=1
)

if not defined SKIP_DEV (
    echo  Starting... will open browser automatically.
    echo  Press Ctrl+C to stop, or close this window.
    echo.
    echo ============================================
    call npm run dev -- --open
    echo.
    echo Server stopped.
)

pause