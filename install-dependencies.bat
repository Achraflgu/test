@echo off
title Track Miner - Dependency Installer

echo.
echo ================================================
echo    Track Miner - Dependency Installer
echo ================================================
echo.

:: Check Node.js
echo [1/4] Checking Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from: https://nodejs.org/
    echo Download the LTS (Long Term Support) version
    echo.
    pause
    exit /b 1
) else (
    node --version
    echo [OK] Node.js is installed
)

echo.

:: Check Python
echo [2/4] Checking Python...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed!
    echo.
    echo Please install Python from: https://www.python.org/
    echo IMPORTANT: Check "Add Python to PATH" during installation
    echo.
    pause
    exit /b 1
) else (
    python --version
    echo [OK] Python is installed
)

echo.

:: Install spotdl
echo [3/4] Installing spotdl...
python -m spotdl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo spotdl not found. Installing...
    python -m pip install spotdl
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install spotdl
        echo Try running: pip install spotdl
        pause
        exit /b 1
    )
) else (
    echo [OK] spotdl is already installed
    python -m spotdl --version
)

echo.

:: Install npm dependencies
echo [4/4] Installing npm dependencies...

echo.
echo Installing frontend dependencies...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install frontend dependencies
    pause
    exit /b 1
)

echo.
echo Installing backend dependencies...
cd server
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install backend dependencies
    pause
    exit /b 1
)
cd ..

echo.
echo ================================================
echo           Installation Complete! ✓
echo ================================================
echo.
echo All dependencies are installed successfully!
echo.
echo Next steps:
echo   1. Double-click 'start-all.bat' to run the app
echo   2. Open http://localhost:5173 in your browser
echo   3. Start downloading playlists!
echo.
echo For more help, see QUICKSTART.md
echo.
pause

