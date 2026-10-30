#!/usr/bin/env bash
# ==============================================================================
# Ternfall Studio — Local Environment Bootstrap & Health Check
# ==============================================================================

set -euo pipefail

echo ""
echo "======================================================================"
echo "           TERNFALL STUDIO — LOCAL ENVIRONMENT BOOTSTRAP              "
echo "======================================================================"
echo ""

# 1. Check Node.js
echo -n "[1/5] Checking Node.js runtime... "
if ! command -v node >/dev/null 2>&1; then
  echo "FAIL"
  echo "      Node.js is not installed. Please install Node.js 22.13+ (required for SQLite)."
  exit 1
fi
if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 13) ? 0 : 1)'; then
  echo "FAIL (Node.js 22.13+ required)"
  exit 1
fi
NODE_VER=$(node -v)
echo "OK ($NODE_VER)"

# 2. Check FFmpeg
echo -n "[2/5] Checking FFmpeg and FFprobe... "
if command -v ffmpeg >/dev/null 2>&1 && command -v ffprobe >/dev/null 2>&1; then
  FFMPEG_VER=$(ffmpeg -version | head -n 1 | awk '{print $3}')
  echo "OK (ffmpeg $FFMPEG_VER)"
else
  echo "WARNING (FFmpeg not detected)"
  echo "      FFmpeg is recommended for local video rendering."
  echo "      Install via: sudo apt update && sudo apt install -y ffmpeg"
fi

# 3. Check .env
echo -n "[3/5] Checking environment configuration (.env)... "
if [ ! -f ".env" ]; then
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo "CREATED (.env copied from .env.example)"
    echo "      NOTE: No API key is required for local planning. Paid generation remains disabled."
  else
    echo "MISSING (.env not found)"
  fi
else
  echo "OK (.env exists)"
fi

# 4. Run Unit Tests
echo -n "[4/5] Running core validation test suite... "
if npm test >/dev/null 2>&1; then
  echo "PASSED (all tests green)"
else
  echo "FAIL (Tests reported errors)"
  npm test
  exit 1
fi

# 5. Check Studio CLI
echo -n "[5/5] Checking studio CLI... "
if npm run studio -- doctor --json >/dev/null 2>&1; then
  echo "PASSED (studio CLI active)"
else
  echo "FAIL"
  exit 1
fi

echo ""
echo "======================================================================"
echo "  Listed local checks passed; this is not production-readiness certification."
echo ""
echo "  To start the full-stack web studio:"
echo "    npm run dev"
echo ""
echo "  To launch an OpenCode agent in this terminal:"
echo "    opencode"
echo ""
echo "  To see turnkey agent instructions and CLI commands:"
echo "    cat AI_AGENT_START_GUIDE.md"
echo "    npm run studio -- ai-prompt"
echo "======================================================================"
echo ""
