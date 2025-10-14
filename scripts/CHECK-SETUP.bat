@echo off
title Track Miner - Setup Checker

echo.
echo ================================================
echo      Track Miner - Setup Verification
echo ================================================
echo.

set "all_ok=1"

:: Check Node.js
echo [CHECK 1/6] Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Node.js not found
    echo   Install from: https://nodejs.org/
    set "all_ok=0"
) else (
    for /f "tokens=*" %%i in ('node --version') do set node_ver=%%i
    echo   [OK] Node.js !node_ver!
)

echo.

:: Check npm
echo [CHECK 2/6] npm
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] npm not found
    set "all_ok=0"
) else (
    for /f "tokens=*" %%i in ('npm --version') do set npm_ver=%%i
    echo   [OK] npm !npm_ver!
)

echo.

:: Check Python
echo [CHECK 3/6] Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] Python not found
    echo   Install from: https://www.python.org/
    set "all_ok=0"
) else (
    for /f "tokens=*" %%i in ('python --version') do set py_ver=%%i
    echo   [OK] !py_ver!
)

echo.

:: Check pip
echo [CHECK 4/6] pip
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] pip not found
    set "all_ok=0"
) else (
    echo   [OK] pip is installed
)

echo.

:: Check spotdl
echo [CHECK 5/6] spotdl
python -m spotdl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [FAIL] spotdl not found
    echo   Install with: pip install spotdl
    set "all_ok=0"
) else (
    for /f "tokens=*" %%i in ('python -m spotdl --version 2^>^&1') do set spotdl_ver=%%i
    echo   [OK] !spotdl_ver!
)

echo.

:: Check npm dependencies
echo [CHECK 6/6] npm dependencies
if not exist "node_modules" (
    echo   [WARN] Frontend dependencies not installed
    echo   Run: npm install
    set "all_ok=0"
) else (
    echo   [OK] Frontend dependencies installed
)

if not exist "server\node_modules" (
    echo   [WARN] Backend dependencies not installed
    echo   Run: cd server ^&^& npm install
    set "all_ok=0"
) else (
    echo   [OK] Backend dependencies installed
)

echo.
echo ================================================

if "%all_ok%"=="1" (
    echo          ✓ ALL CHECKS PASSED ✓
    echo ================================================
    echo.
    echo Your system is ready to run Track Miner!
    echo.
    echo To start the application:
    echo   - Double-click 'start-all.bat'
    echo   - Or run 'start-server.bat' and 'start-frontend.bat'
    echo.
    echo Then open: http://localhost:5173
) else (
    echo          ✗ SOME CHECKS FAILED ✗
    echo ================================================
    echo.
    echo Please fix the issues above before running the app.
    echo.
    echo Quick fixes:
    echo   - Node.js: https://nodejs.org/
    echo   - Python: https://www.python.org/
    echo   - spotdl: pip install spotdl
    echo   - Dependencies: run install-dependencies.bat
    echo.
    echo For detailed help, see SETUP.md
)

echo.
pause

