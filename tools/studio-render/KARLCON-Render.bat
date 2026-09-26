@echo off
setlocal EnableExtensions
title KARLCON Studio - record to video
cd /d "%~dp0"

echo.
echo  ==========================================================
echo    KARLCON STUDIO  -  record the show to an MP4
echo  ==========================================================
echo.

rem ---- Node.js ------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js is not installed.
  echo  Install the LTS version from https://nodejs.org , then run this again.
  start "" https://nodejs.org
  pause & exit /b 1
)

rem ---- first run: install the recorder (and its own ffmpeg) ----
if not exist "node_modules\playwright-core" (
  echo  First run: installing the recorder. This takes a minute...
  call npm install --no-audit --no-fund
  if errorlevel 1 ( echo. & echo  Install failed - check the internet connection and try again. & pause & exit /b 1 )
  echo.
)

rem ---- what to record ------------------------------------------
echo  What do you want to record?
echo.
echo    1  Test: Episode 1 only            (about 4 minutes of video)
echo    2  All six episodes                (about 25 minutes)
echo    3  Marathon, 3 hours               (episodes + Claude's new segments)
echo    4  Marathon, 1 hour
echo    5  One episode (choose 1-6)
echo.
set "CHOICE="
set /p "CHOICE=  Type 1-5 and press Enter: "
set "WHAT="
if "%CHOICE%"=="1" (set "WHAT=--ep 1" & set "NAME=test-episode-1")
if "%CHOICE%"=="2" (set "WHAT=--ep all" & set "NAME=all-episodes")
if "%CHOICE%"=="3" (set "WHAT=--mode marathon --dur 3h" & set "NAME=marathon-3h")
if "%CHOICE%"=="4" (set "WHAT=--mode marathon --dur 1h" & set "NAME=marathon-1h")
if "%CHOICE%"=="5" (
  set /p "EPN=  Which episode (1-6)? "
  call set "WHAT=--ep %%EPN%%"
  call set "NAME=episode-%%EPN%%"
)
if not defined WHAT ( echo  Not a valid choice. & pause & exit /b 1 )

echo.
echo  Shape:   1 = 9:16 vertical (Instagram / Facebook)    2 = 16:9 landscape (YouTube)
set "FMT=vertical"
set /p "F=  Type 1 or 2 [1]: "
if "%F%"=="2" set "FMT=landscape"

echo  Quality: 1 = High (strong PC)    2 = Standard (faster on a laptop)
set "Q=high"
set /p "QQ=  Type 1 or 2 [1]: "
if "%QQ%"=="2" set "Q=standard"

rem ---- passcode (typed hidden, never saved) ----------------------
echo.
if defined STUDIO_KEY goto haskey
for /f "usebackq delims=" %%K in (`powershell -NoProfile -Command "$p=Read-Host '  Studio passcode (for the voices)' -AsSecureString; [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($p))"`) do set "STUDIO_KEY=%%K"
:haskey
if not defined STUDIO_KEY echo  No passcode: the video will have music only, no voices.

rem ---- record ------------------------------------------------------
if not exist "videos" mkdir "videos"
for /f %%T in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HHmm"') do set "STAMP=%%T"
set "OUT=videos\%NAME%-%FMT%-%STAMP%.mp4"

echo.
echo  Recording to %OUT%
echo  Keep this window open. Ctrl+C stops early and still saves what is done.
echo.
node render.mjs %WHAT% --format %FMT% --quality %Q% --out "%OUT%" %*
if errorlevel 1 ( echo. & echo  Something went wrong - send a screenshot of this window. & pause & exit /b 1 )

echo.
echo  Done! Opening the videos folder...
start "" explorer "%~dp0videos"
pause
