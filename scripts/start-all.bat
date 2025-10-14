@echo off
title Track Miner - Launcher

echo.
echo ================================================
echo        Track Miner - Spotify Downloader
echo ================================================
echo.
echo Starting both frontend and backend servers...
echo.

:: Start backend in a new window
start "Track Miner - Backend" cmd /k "start-server.bat"

:: Wait a moment for backend to start
timeout /t 3 /nobreak >nul

:: Start frontend in a new window
start "Track Miner - Frontend" cmd /k "start-frontend.bat"

echo.
echo Both servers are starting in separate windows...
echo.
echo Frontend will be available at: http://localhost:5173
echo Backend API will be available at: http://localhost:3001
echo.
echo Press any key to exit this launcher (servers will keep running)...
pause >nul

