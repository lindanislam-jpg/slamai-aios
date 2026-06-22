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

if not exist "node_modules" (
  echo [1/4] Installing dependencies...
  call npm install
  echo.
)

if not exist "prisma\dev.db" (
  echo [2/4] Setting up database...
  call npx prisma generate
  call npx prisma db push
  echo.
  echo [3/4] Seeding demo data...
  call npx tsx prisma\seed.ts
  echo.
)

echo [4/4] Starting SlamAI AIOS on http://localhost:3005
echo.
echo  Login: admin@slamai.com / Admin@1234
echo.
start http://localhost:3005
call npm run dev
pause
