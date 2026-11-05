@echo off
title SlamAI TV
color 0D
echo.
echo  ============================================
echo   SLAMAI TV - Live channels, every screen
echo  ============================================
echo.

cd /d "%~dp0"

REM SlamAI TV keeps everything in the browser, so it needs no database and no
REM .env.local. That is why this launcher skips the checks the main one does.

if not exist "node_modules" (
  echo  [1/3] Installing dependencies. First run only, give it a minute...
  call npm install
  echo.
)

echo  [2/3] Preparing...
call npx prisma generate >nul 2>&1
echo.

echo  [3/3] Starting on http://localhost:3005/tv
echo.
echo   On your phone: connect to the same Wi-Fi and open
echo   http://YOUR-LAPTOP-IP:3005/tv  (run ipconfig to find the IP)
echo.
echo   Leave this window open while you watch.
echo   Close it, or press Ctrl+C, to stop.
echo.
start http://localhost:3005/tv
call npm run dev
pause
