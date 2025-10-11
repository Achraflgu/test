@echo off
echo ========================================
echo   Updating yt-dlp to latest version
echo ========================================
echo.

REM Update yt-dlp using pip
pip install --upgrade yt-dlp

echo.
echo ========================================
echo   yt-dlp updated successfully!
echo ========================================
echo.
echo Current version:
yt-dlp --version

echo.
pause

