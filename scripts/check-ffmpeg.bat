@echo off
echo ========================================
echo FFMPEG INSTALLATION CHECK
echo ========================================
echo.

echo Checking for ffmpeg...
where ffmpeg >nul 2>&1
if %errorlevel% equ 0 (
    echo [32m✓ ffmpeg is installed and in PATH[0m
    echo.
    echo Version info:
    ffmpeg -version | findstr "ffmpeg version"
    echo.
    echo [32m✓ Your system should be able to convert audio files properly![0m
) else (
    echo [31m✗ ffmpeg is NOT found in PATH[0m
    echo.
    echo [33mFFMPEG IS REQUIRED for converting downloaded videos to MP3![0m
    echo.
    echo [36mTo install ffmpeg:[0m
    echo 1. Download from: https://github.com/BtbN/FFmpeg-Builds/releases
    echo    ^(Download: ffmpeg-master-latest-win64-gpl.zip^)
    echo.
    echo 2. Extract the ZIP file
    echo.
    echo 3. Copy the 'bin' folder contents to one of these locations:
    echo    - C:\ffmpeg\bin\
    echo    - Add the bin folder to your System PATH
    echo.
    echo 4. Restart this application and try again
    echo.
    echo [36mQuick Install Method (using winget):[0m
    echo    winget install ffmpeg
    echo.
    echo [36mAlternative (using chocolatey):[0m
    echo    choco install ffmpeg
)

echo.
echo ========================================
pause


