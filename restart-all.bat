@echo off
echo ========================================
echo RESTARTING TRACK MINER
echo ========================================
echo.

echo [33mStopping any running processes...[0m
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [32mStarting server and frontend...[0m
echo.

start "" cmd /c "cd server && node index.js"
timeout /t 3 /nobreak >nul
start "" cmd /c "npm run dev"

echo.
echo [32m✓ Track Miner is restarting![0m
echo.
echo Server: http://localhost:3001
echo Frontend: http://localhost:8080
echo.
echo ========================================
pause

