@echo off
title Update yt-dlp

echo.
echo ================================================
echo    Updating yt-dlp (YouTube Downloader)
echo ================================================
echo.
echo yt-dlp is the tool that downloads music from YouTube.
echo If it's outdated, downloads will fail!
echo.
echo Updating now...
echo.

python -m pip install --upgrade yt-dlp

echo.
echo ================================================
echo             Update Complete!
echo ================================================
echo.
echo Now restart your backend server and try again.
echo.
pause

