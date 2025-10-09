@echo off
echo ========================================
echo   Clean Server Folder
echo ========================================
echo.
echo This will DELETE all .mp3 files from the server\ folder.
echo These files shouldn't be there - they were created during testing.
echo.
echo Downloads should go to your specified folder (e.g., Downloads\yyyy\),
echo NOT to the server folder!
echo.
pause

cd /d "%~dp0"
cd server

echo.
echo Deleting .mp3 files from server folder...
del /F /Q *.mp3 2>nul

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Successfully cleaned server folder!
    echo.
    echo The server folder should now only contain:
    echo   - index.js
    echo   - package.json
    echo   - package-lock.json
    echo   - node_modules\
    echo.
) else (
    echo.
    echo ⚠️  No .mp3 files found or error occurred.
    echo.
)

echo ========================================
pause

