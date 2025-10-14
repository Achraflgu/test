@echo off
setlocal enabledelayedexpansion

echo ========================================
echo CLEANUP INCOMPLETE DOWNLOAD FILES
echo ========================================
echo.
echo This will remove:
echo - .webm files (unconverted video files)
echo - .webm.part files (incomplete downloads)
echo - .webp files (thumbnail files)
echo - .part files (any incomplete files)
echo.

set /p folder="Enter the folder path containing incomplete files: "

if not exist "%folder%" (
    echo [31mFolder not found: %folder%[0m
    pause
    exit /b 1
)

echo.
echo Searching in: %folder%
echo.

set count=0

echo [33mFound incomplete files:[0m
echo.

for %%F in ("%folder%\*.webm" "%folder%\*.webm.part" "%folder%\*.webp" "%folder%\*.part") do (
    echo   - %%~nxF
    set /a count+=1
)

if %count%==0 (
    echo [32mNo incomplete files found! Your folder is clean.[0m
    echo.
    pause
    exit /b 0
)

echo.
echo [33mTotal incomplete files found: %count%[0m
echo.

set /p confirm="Do you want to delete these files? (Y/N): "

if /i "%confirm%"=="Y" (
    echo.
    echo [36mDeleting incomplete files...[0m
    echo.
    
    set deleted=0
    
    for %%F in ("%folder%\*.webm" "%folder%\*.webm.part" "%folder%\*.webp" "%folder%\*.part") do (
        del "%%F"
        echo   ✓ Deleted: %%~nxF
        set /a deleted+=1
    )
    
    echo.
    echo [32m✓ Cleanup complete! Deleted %deleted% files.[0m
) else (
    echo.
    echo [33mCleanup cancelled.[0m
)

echo.
echo ========================================
pause


