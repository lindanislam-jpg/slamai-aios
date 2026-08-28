@echo off
title SlamAI AIOS
color 0A
echo.
echo  ============================================
echo   SlamAI AIOS - The AI Operating System
echo   One Platform. Infinite Intelligence.
echo  ============================================
echo.

cd /d "%~dp0"

if not exist ".env.local" (
  echo  [!] No .env.local found.
  echo.
  echo      Copy .env.example to .env.local and fill in your keys
  echo      before starting. Nothing will work without them.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/3] Installing dependencies...
  call npm install
  echo.
)

echo [2/3] Syncing database...
call npx prisma generate
call npx prisma db push
echo.

echo [3/3] Starting SlamAI AIOS on http://localhost:3005
echo.
start http://localhost:3005
call npm run dev
pause
