# Windows 10/11 & WSL2 Setup Guide — Ternfall Studio

Ternfall Studio is a **local-first production studio**. While built and iterated in Google AI Studio, its production runtime is designed for single-operator execution on a Windows 10/11 PC.

## Prerequisites

1. **Windows 10/11** with **WSL2** installed (recommended: Ubuntu 22.04+ or 24.04).
2. **Node.js** v20+ or v22+ LTS installed in WSL:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
3. **FFmpeg & FFprobe** installed for video and audio rendering:
   ```bash
   sudo apt-get update && sudo apt-get install -y ffmpeg
   ffmpeg -version
   ```
4. **OpenCode CLI** (optional external coding agent):
   ```bash
   npm install -g opencode
   ```

## Startup Commands

1. Export project from AI Studio (Download ZIP or Git Sync).
2. Open Windows Terminal in WSL:
   ```bash
   cd ~/ternfall-studio
   npm install
   ```
3. Run test suite:
   ```bash
   npm run test
   ```
4. Start local service (binds to loopback 127.0.0.1:3000):
   ```bash
   npm run dev
   ```
5. Open your browser to `http://localhost:3000`.
6. Run **Doctor Diagnostics** from the left navigation bar to verify storage permissions, FFmpeg detection, and provider keys.
