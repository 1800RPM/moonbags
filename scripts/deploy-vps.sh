#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "[moonbags] root: $ROOT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "[moonbags] Node.js is missing. Install Node 20+ first."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "[moonbags] npm is missing. Install Node.js with npm first."
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "[moonbags] Node.js 20+ is required. Current: $(node -v)"
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "[moonbags] Missing .env in $ROOT_DIR"
  echo "[moonbags] Copy your working .env to the VPS before running this script."
  exit 1
fi

mkdir -p logs state

echo "[moonbags] installing project dependencies"
npm install

if ! command -v onchainos >/dev/null 2>&1; then
  echo "[moonbags] installing onchainos"
  curl -fsSL https://raw.githubusercontent.com/okx/onchainos-skills/main/install.sh | bash
  export PATH="$HOME/.local/bin:$PATH"
fi

echo "[moonbags] onchainos: $(command -v onchainos)"
onchainos --version

if ! command -v pm2 >/dev/null 2>&1; then
  echo "[moonbags] installing pm2"
  npm install -g pm2
fi

echo "[moonbags] starting moonbags with pm2"
pm2 start ecosystem.config.cjs --update-env
pm2 save

echo
echo "[moonbags] done"
echo "[moonbags] next useful commands:"
echo "  pm2 status"
echo "  pm2 logs moonbags"
echo "  pm2 startup"
