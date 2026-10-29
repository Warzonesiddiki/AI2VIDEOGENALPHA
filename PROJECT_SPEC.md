# PROJECT_SPEC.md — Ternfall Studio (100% Automated Video Pipeline)

**Document Version**: 1.0.0  
**Status**: APPROVED & ACTIVE (Single Source of Truth)  
**Lead Engineer / Technical Co-Founder**: AI Studio Engine  
**Product Owner**: Siddiki  

---

## 1. Goal
Provide a zero-compromise, 100% automated local-first production studio that produces broadcast-quality, long-form (10–15 min) 24fps animated survival thriller videos (*The Quiet Hours: Ternfall*) ready for direct upload to YouTube. Image and visual asset generation is automated via **Google Flow (`flow.google.com`)** in native 24-frame batches across **3 Pro accounts** at $0.00 billable API cost, while narrative structuring, voiceover, procedural audio design, Foley, signature 8-beat mechanical tension pulse music, and 24fps FFmpeg video rendering are processed locally on the user's machine.

---

## 2. Users & Usage Context
* **Primary User**: Single showrunner / creator operating locally on Windows/WSL2 or Linux with local FFmpeg.
* **Context**: The user wants to press a button, run an automated worker across their 3 Google Flow Pro accounts, and receive a finished 1080p 24fps MP4 video + 9:16 vertical Short + complete YouTube package (Title, Chapters, Description, Tags) without manual editing, keyframing, or video compositing software.

---

## 3. Project-Level Success Criteria
*This project succeeds when:*
1. **Zero-Touch Video Production**: The user can pick any episode (e.g. S01E001) and generate a broadcast-ready 1080p 24fps MP4 video file and YouTube package in an automated sequence without human manual editing.
2. **Batch & Multi-Account Integrity**: The system correctly partitions any runtime into exact 24-frame batches (e.g. 10 min @ 24fps = 14,400 frames = 600 batches) and load-balances them across 3 Pro accounts with automatic resume and zero dropped frames.
3. **Audio Quality Compliance**: The local procedural audio mix meets YouTube's broadcast loudness specification of **-14.0 LUFS ±0.5 LUFS** with a **-1.0 dB True Peak ceiling** and includes the canon 55Hz 8-beat mechanical tension pulse and rain Foley.
4. **$0.00 Billable Generation Cost**: All visual assets generated through `flow.google.com` Pro accounts and all audio synthesized locally incur $0.00 in per-frame API billing.

---

## 4. Features & Testable Acceptance Criteria

### Feature 1: Google Flow 24-Frame Batch Engine & 3-Account Load Balancer
* **Done when**:
  1. User can request a plan for any duration (1 to 15 minutes) and the engine calculates exact frames (`duration * 24`) and batches (`ceil(frames / 24)`).
  2. Every batch is assigned to Account 1, 2, or 3 in round-robin sequence with balanced counts.
  3. Every batch provides 24 individualized frame prompts containing micro-movements, timecodes, character visual anchors (Rhea Mistry), environment ingredients, and negative prompts.
  4. User can click "Copy 24 Prompts" and the formatted text is placed in the clipboard within 200ms.

### Feature 2: Automated Headless Auto-Worker (`flow_autoworker.js`)
* **Done when**:
  1. The user can view and execute `node scripts/flow_autoworker_S01E001.js`.
  2. The worker loads account credentials, executes batch requests sequentially, stores downloaded frames named `frame_00001.png` to `frame_14400.png` in `./data/production_root/projects/{projectId}/assets/flow_renders/{epId}/`, and records verification via the local API.
  3. Batch checkpointing allows resuming interrupted runs from the exact last missing frame without re-generating completed batches.

### Feature 3: Batch Ingestion & Missing Frame Validator
* **Done when**:
  1. The validator inspects the render folder and checks that all 24 frames (1..24) are present for each batch.
  2. If any frame is missing, the validator flags the exact missing frame numbers and marks the batch as incomplete.
  3. If all frames are present, the batch status is updated to `verified` within 500ms.

### Feature 4: Local Procedural Audio Studio & 8-Beat Pulse Synthesizer
* **Done when**:
  1. The engine synthesizes Stem 1 (55Hz sub-bass 8-beat mechanical pulse with 3s silence intervals), Stem 2 (filtered rain and drainage pipe Foley), and Stem 3 (dialogue/narration with auto-ducking).
  2. The output mix is normalized via FFmpeg `loudnorm` filter to `-14.0 LUFS ±0.5 LUFS` and written to a 48kHz 24-bit WAV file.
  3. The user can click "Preview 8-Beat Synth Pulse" in the UI and hear the live procedural audio within 200ms.

### Feature 5: Local 24fps Master Video & YouTube Shorts Assembler
* **Done when**:
  1. The system generates `render_youtube_{epId}_master.sh` that uses FFmpeg to stitch sequential PNG frames at 24fps into a 1920×1080 H.264 High@L4.1 master MP4 with stereo AAC audio.
  2. The script simultaneously renders a 59-second vertical 9:16 Short (1080×1920) cropped and centered from the climax sequence.
  3. The execution finishes with an automated `ffprobe` verification report confirming duration, 24fps frame rate, and zero dropped frames.

### Feature 6: In-Browser Video Player & Chapter Scrubbing QC
* **Done when**:
  1. The user can watch the rendered video directly inside the Studio UI in an HTML5 video player.
  2. Clicking any of the 9 story beat chapter buttons jumps the video playhead to the exact corresponding timestamp within 100ms.

### Feature 7: Automated YouTube Metadata & Disclosure Package
* **Done when**:
  1. The system outputs 3 high-CTR title options, formatted description with clickable chapter timestamps, SEO tags, pinned comment draft, and required synthetic media disclosure notices.
  2. The user can click "Copy Complete Metadata" and have all fields formatted in clipboard within 200ms.

### Feature 8: Single-Click "Autoproduce Full Master Video"
* **Done when**:
  1. The user can click one primary button ("Run Full Automated Pipeline") or run `npm run studio -- flow autoproduce --episode S01E001`.
  2. The studio executes the full chain: Plan Check -> Frame Verification -> Audio Generation -> Video Stitch -> Shorts Cut -> YouTube Package Generation, updating the visual progress HUD in real-time.

---

## 5. Non-Goals
1. **Third-Party Video Editing Suite Integration**: We will NOT require Adobe Premiere, DaVinci Resolve, or Final Cut. All stitching and audio multiplexing is handled natively by local FFmpeg.
2. **Paid Cloud GPU Video Services**: We will NOT use paid cloud rendering farms (Runway, Sora, Pika). All video rendering is local.
3. **Public Unattended YouTube Publishing**: Per the repository security contract in `AGENTS.md`, unattended agents will NOT publish directly to YouTube publicly without human review; the system generates the verified private package and ready-to-publish files.

---

## 6. Design Direction
* **Typography**: Plus Jakarta Sans for UI labels, JetBrains Mono for timecodes, frame counters, and script snippets.
* **Color Palette**: Dark cinema aesthetic (`bg-slate-950`), Estuary Teal accents (`#0D9488` / `text-teal-400`), Sodium-Amber emergency indicators (`#F59E0B`), and Slate gray borders (`border-slate-800`).
* **Tone**: Professional, high-precision film and broadcast control room.
* **Device Priority**: Desktop / Laptop browser viewports (1440×900 primary, responsive down to 1024px).

---

## 7. Tech Constraints
* **Runtime**: Node.js 22, Express server (`server.ts`), Vite, React 19, TypeScript.
* **Rendering Engine**: FFmpeg with `libx264`, `aac`, `lavfi`, and `loudnorm` filters.
* **Storage**: Local-first atomic JSON filesystem under `./data/production_root/projects/{projectId}/`.
* **Zero Secrets Client-Side**: All tokens and environment variables remain server-side.

---

## 8. Current State Summary
* **Exists & Verified**: Core 24-frame batch math, 3-account load balancer, Google Flow prompts generator, local audio mix script generator, 24fps FFmpeg stitch script, unit tests (26/26 passing), Express API endpoints, and tabbed Google Flow UI.
* **Needs Completion for 100% Zero-Touch Automation**:
  1. Checkpoint/resume state manager for multi-batch generation.
  2. Integrated in-browser HTML5 video player with 9-beat chapter scrubbing.
  3. Single-click "Autoproduce Full Master" execution runner in both UI and CLI.
  4. Pre-flight YouTube Technical QC card (verifying 24fps, -14.0 LUFS, audio sync, and rights clearance).
  5. Storage usage & disk cleanup manager.
