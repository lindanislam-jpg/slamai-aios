#!/bin/bash
# SlamAI AIOS - macOS launcher
# Double-click this file in Finder, or run: ./"Start SlamAI AIOS.command"
# macOS equivalent of "Start SlamAI AIOS.bat" (kept for Windows).

set -e
cd "$(dirname "$0")"

echo ""
echo " ============================================"
echo "  SlamAI AIOS - The AI Operating System"
echo "  One Platform. Infinite Intelligence."
echo " ============================================"
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js is not installed."
  echo "Install it with:  brew install node"
  echo "(Homebrew: https://brew.sh)"
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[1/4] Installing dependencies..."
  npm install
  echo ""
fi

if [ ! -f "prisma/dev.db" ]; then
  echo "[2/4] Setting up database..."
  npx prisma generate
  npx prisma db push
  echo ""
  echo "[3/4] Seeding demo data..."
  npx tsx prisma/seed.ts
  echo ""
fi

echo "[4/4] Starting SlamAI AIOS on http://localhost:3005"
echo ""
echo " Sign in with your admin account."
echo " Credentials are NOT stored in this file - see prisma/seed.ts"
echo ""

# Open the browser once the dev server is actually accepting connections.
(
  for _ in $(seq 1 60); do
    if curl -sSf -o /dev/null http://localhost:3005 2>/dev/null; then
      open http://localhost:3005
      break
    fi
    sleep 1
  done
) &

npm run dev
