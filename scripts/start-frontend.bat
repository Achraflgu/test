@echo off
title Track Miner - Frontend

echo.
echo ====================================
echo    Track Miner - Frontend
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

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install
)

echo.
echo Starting frontend development server...
echo.

:: Start the frontend
call npm run dev

pause

