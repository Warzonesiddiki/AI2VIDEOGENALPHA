# Ternfall Studio — Local Operator & AI Agent Start Guide

Welcome to **Ternfall Studio** (*The Quiet Hours: Ternfall*), a local-first production studio for producing original serialized animated survival-thriller videos for YouTube.

This guide provides everything needed when you open a terminal in this project folder and launch an autonomous coding or production AI agent (such as **OpenCode**, **Claude Code**, **Cursor**, or **Aider**).

---

## 1. Quick Audit: What Is Already Built & Ready

| Subsystem | Status | Description |
| :--- | :--- | :--- |
| **Full-Stack Production App** | **Ready** | Express + Vite full-stack engine running on `http://localhost:3000` (`npm run dev`). |
| **Series Bible & 1,000-Ep Backbone** | **Seeded** | 100 Arcs, character profiles (Rhea Mistry, Mara Ilyan), South Gate lore, and hard canon invariants. |
| **Pilot Episode (S01E001)** | **Ready** | Complete 9-beat sheet and narrative script ("The Eight-Beat Failure"). |
| **Episode S01E002 Card** | **Ready** | "The Siphon Effect" initialized with 9-beat structure. |
| **Unit Test Suite** | **15/15 Passing** | Pacing calculator (140-160 WPM), Jaccard similarity, hard canon rules, SSRF defense, atomic budget cap logic, spend grant security. |
| **Typed Automation CLI (`studio`)** | **Ready** | Safe CLI with `--json` outputs, path traversal defense, and atomic spend controls. |
| **YouTube Operations Runbook** | **Ready** | 10-point preflight checklist, metadata copier, `.srt` generator, and strict private-by-default release lock. |
| **In-Browser Terminal** | **Ready** | Embedded CLI runner in Doctor Diagnostics view for cloud preview or browser testing. |

---

## 2. What Is Pending (Required on Your Local PC)

When running locally on Windows 10/11 (WSL2 recommended) or Linux:

1. **Environment Secrets (`.env`)**:
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Insert your real `GEMINI_API_KEY`:
     ```env
     GEMINI_API_KEY="AIzaSy..."
     PORT=3000
     ```
2. **Local FFmpeg & FFprobe (for video/audio rendering)**:
   - In WSL2 / Ubuntu / Debian:
     ```bash
     sudo apt update && sudo apt install -y ffmpeg
     ffmpeg -version
     ```
   - In native Windows:
     ```powershell
     winget install Gyan.FFmpeg
     ```
3. **Node.js LTS (v20+ or v22+)**:
   - Verify with: `node -v` (should be >= v20.0.0).
   - Install dependencies: `npm install`.

---

## 3. Launching Your AI Agent in the Project Folder

When you launch your AI agent inside this repository directory (`opencode`, `claude`, `cursor`, etc.), paste this prompt into the agent:

```text
You are the autonomous production operator for Ternfall Studio (The Quiet Hours: Ternfall).
This repository is an offline-first animated survival thriller studio.

STRICT INVARIANTS:
1. All changes must go through the typed CLI: `npm run studio -- <command> --json`.
2. Do not modify files outside `./data/production_root/`.
3. Never initiate public releases or alter privacy from 'private'.
4. Grounded survivor canon: Protagonist Rhea Mistry (water engineer), South Gate setting, 8-beat mechanical siren failure. Contact transmission only. Non-airborne. Non-waterborne.
5. Pacing standard: 140-160 WPM (~2,175 words for 15-minute standard episode).

YOUR WORKFLOW:
1. Check environment health: `npm run studio -- doctor --json`
2. Check world rules & active canon:
   - `npm run studio -- series list --json`
   - `npm run studio -- continuity report --json`
3. Inspect current episodes: `npm run studio -- episode list --json`
4. When drafting an episode:
   - Create episode card: `npm run studio -- episode create --id S01E003 --title "Title" --arc 1 --json`
   - Update narration: `npm run studio -- episode update-script S01E003 --file ./script.txt --json`
   - Validate pacing & canon: `npm run studio -- episode check S01E003 --json`
5. Record newly established canon facts or clues:
   - `npm run studio -- continuity add --episode S01E003 --location "..." --summary "..." --json`
6. Preflight for YouTube packaging:
   - `npm run studio -- youtube preflight --json`
```

---

## 4. Complete Safe CLI Command Reference (`studio`)

All commands support `--json` for machine readability:

### System & Health
```bash
# Full environment audit (storage, binaries, keys, timezone)
npm run studio -- doctor --json

# Print turnkey prompt for local AI agents
npm run studio -- ai-prompt --json
```

### World Bible & Canon Continuity
```bash
# View complete Series Bible and character profiles
npm run studio -- series list --json

# View canon event timeline, character knowledge, injuries, and unresolved clues
npm run studio -- continuity report --json

# Record a new canon event from terminal
npm run studio -- continuity add --episode S01E002 --location "Pumping Station 4" --characters "Rhea Mistry,Kabir" --summary "Rhea and Kabir restore emergency siphon valve" --json

# Add fact-check or fictional lore claim (with SSRF protection)
npm run studio -- research add "Municipal siphon mains can draw reverse air" --json
```

### Episodes & Script Writing
```bash
# List all episode cards and their production status
npm run studio -- episode list --json

# Inspect a specific episode and beat sheet
npm run studio -- episode show S01E001 --json

# Create a new episode card (initialized with 9-beat anchor structure)
npm run studio -- episode create --id S01E003 --title "The Pressure Drop" --arc 1 --logline "Rhea encounters a trapped maintenance crew." --json

# Submit new narration text (auto-calculates word count and checks 140-160 WPM pacing)
npm run studio -- episode update-script S01E003 --text "Your script text here..." --json
# Or from a file:
npm run studio -- episode update-script S01E003 --file ./my_script.txt --json

# Run distinctness check (Jaccard similarity against all prior episodes) and hard canon rules
npm run studio -- episode check S01E003 --json

# Mark script approved (editorial sign-off)
npm run studio -- episode approve S01E003 --json
```

### Spend Grants & Production Pipeline
```bash
# OPERATOR ONLY: Mint an authorized spend grant with hard dollar cap and expiration
npm run studio -- spend authorize --amount 25.00 --hours 24 --json

# List active operator spend grants
npm run studio -- spend list --json

# Queue a supervised autoproduction run within authorized budget cap
npm run studio -- episode produce --episode S01E001 --approval-id <YOUR_GRANT_ID> --json

# Inspect status of an autoproducer run
npm run studio -- run status run_001 --json
```

### Local Video Rendering & YouTube Handoff
```bash
# Generate local FFmpeg rendering shell script for offline 1080p MP4 composite
npm run studio -- render script S01E001 --save --json

# Run YouTube 10-point upload safety gate
npm run studio -- youtube preflight --json
```

---

## 5. What Would Be "Good to Have" Next (Enhancement Roadmap)

If you wish to expand the studio further after starting local production, the following optional enhancements can be added:

1. **Local Whisper/Kokoro Audio Integration**:
   - Add a local offline TTS adapter (e.g. Kokoro-82M or Coqui) in `server/voiceAdapter.ts` for 100% zero-cost local voice narration without Google Cloud Chirp.
2. **Local ComfyUI / Stable Diffusion Adapter**:
   - Add a direct WebSocket client to connect to a local ComfyUI instance (running on an RTX 3060/4090 GPU) for zero-cost image generation.
3. **Automated Remotion / Canvas Renderer**:
   - Package the Ken Burns 2.5D camera pan/zoom into a headless Node Remotion bundle for programmatic render previews.
4. **Desktop Tray Launcher**:
   - An Electron or Tauri wrapper if you prefer a single-click native desktop window over browser tab navigation.
