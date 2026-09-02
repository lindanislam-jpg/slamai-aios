@echo off
title Elite Life OS
color 0A
echo.
echo  ============================================
echo   ELITE LIFE OS - Personal Command Center
echo   Win tomorrow tonight. Protect your morning.
echo  ============================================
echo.

cd /d "%~dp0"

REM Life OS keeps everything in the browser, so it needs no database and no
REM .env.local. That is why this launcher skips the checks the main one does.

if not exist "node_modules" (
  echo  [1/3] Installing dependencies. First run only, give it a minute...
  call npm install
  echo.
)

echo  [2/3] Preparing...
call npx prisma generate >nul 2>&1
echo.

echo  [3/3] Starting on http://localhost:3005/life
echo.
echo   Leave this window open while you use it.
echo   Close it, or press Ctrl+C, to stop.
echo.
start http://localhost:3005/life
call npm run dev
pause
