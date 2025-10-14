@echo off
title Track Miner - Backend Server

echo.
echo ====================================
echo    Track Miner - Backend Server
echo ====================================
echo.

:: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b
)

:: Check if Python is installed (silent check)
set PYTHON_CMD=
where py >nul 2>&1
if %errorlevel% equ 0 (
    set PYTHON_CMD=py
) else (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        set PYTHON_CMD=python
    ) else (
        echo [ERROR] Python is not installed!
        echo Please install Python from https://www.python.org/
        pause
        exit /b
    )
)

:: Check if spotdl is installed (silent check)
%PYTHON_CMD% -m spotdl --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Installing spotdl...
    %PYTHON_CMD% -m pip install spotdl
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install spotdl!
        echo Please run: %PYTHON_CMD% -m pip install spotdl
        pause
        exit /b
    )
)

:: Navigate to server directory
cd server

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing server dependencies...
    call npm install
)

echo.
echo Starting backend server...
echo.

:: Set yt-dlp config location (fixes YouTube blocking)
set YTDL_OPTIONS_PATH=%CD%\yt-dlp.conf
echo Using yt-dlp config: %YTDL_OPTIONS_PATH%
echo.

:: Start the server
node index.js

pause

