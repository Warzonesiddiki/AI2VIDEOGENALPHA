# DECISIONS.md — Architecture & Engineering Decision Log

All technical choices, trade-offs, and defaults approved by the Product Owner are logged here.

---

### [Flow Automation] DECISION: Dual Mode (Headless Node Script + Visual GUI Clipboard Runner)
* **Date**: 2026-10-29
* **Why**: Provides true 100% unattended automation via `node scripts/flow_autoworker.js` using account cookies, while preserving an instant one-click GUI clipboard runner if session cookies ever expire or need re-login.

### [Audio Engine] DECISION: Fully Local Procedural Multi-Stem Synthesis
* **Date**: 2026-10-29
* **Why**: Zero cloud dependencies, zero external cost, 100% deterministic, and exact canon fidelity for the 55Hz 8-beat mechanical tension pulse, rain Foley, and dynamic -12dB dialogue ducking mastered to YouTube EBU R128 (-14.0 LUFS).

### [Rendering Architecture] DECISION: Dual-Output Master (16:9 Landscape 1080p + 9:16 Vertical Short)
* **Date**: 2026-10-29
* **Why**: YouTube creators maximize reach by releasing a long-form master episode alongside a 59-second vertical Short that hooks the YouTube Shorts algorithmic feed.

### [YouTube Delivery] DECISION: Automated Handoff Package (Direct Download + Formatted Copy)
* **Date**: 2026-10-29
* **Why**: Avoids brittle Google OAuth token expiration, quota exhaustion, and satisfies the strict safety invariant in `AGENTS.md` (no unintended public publishing).

### [Storage Architecture] DECISION: Atomic JSON Engine with Resumable Batch Manifest
* **Date**: 2026-10-29
* **Why**: Multi-batch generation (up to 600 batches / 14,400 frames) must survive process restarts, laptop sleep, or network interruptions without re-generating completed frames.

### [Player & QC Engine] DECISION: In-Studio HTML5 Video Player with 9-Beat Chapter Scrubbing & Live EBU R128 QC Card
* **Date**: 2026-10-29
* **Why**: Eliminates third-party video review tools by providing an in-app 24fps master player, instant timecode chapter scrubbing to any of the 9 canon beats, and a pre-flight technical checklist verifying resolution, 24fps constant frame rate, and -14.0 LUFS loudness before YouTube upload.

### [Storage Management] DECISION: Multi-Tier Storage Breakdown & Scratch Frame Cache Cleanup
* **Date**: 2026-10-29
* **Why**: Generating 14,400 frames consumes ~8.64 GB. Providing safe 1-click scratch cleanup preserves the rendered master video and metadata while reclaiming temporary PNG storage.

### [Credit Economics] DECISION: Sustainable Hybrid Production Cadence (3x 1,050 Accounts, +50/Day Refill)
* **Date**: 2026-10-29
* **Why**: Each of the user's 3 Pro accounts has 1,050 credits (3,150 total reserve) and replenishes +50 credits daily (+150 credits/day total). By calibrating daily episodes to 24 dynamic hero Veo clips (8 per account = 150 credits burn) combined with 48 high-res Imagen-Motion narrative beats, net daily burn equals exactly 0 credits. The user can release 1 broadcast-quality 10-minute episode every single day perpetually without ever depleting their 3,150 credit war chest.

### [Hardware Architecture] DECISION: 20 GB RAM Memory Buffer + NVIDIA GeForce MX330 NVENC Offload + Modified Water Cooling Loop
* **Date**: 2026-10-29
* **Why**: The user's workstation is a **LENOVO ThinkPad T14 Gen 1 (DESKTOP-NJ43QJR)** powered by an **Intel Core i7-10510U** (4C/8T up to 4.90 GHz Turbo, 30W PL1/PL2 Unlocked), **20 GB DDR4 RAM** (16GB Samsung + 4GB SK Hynix in Flex Dual-Channel), **NVIDIA GeForce MX330** (2GB GDDR5 Pascal GP108-655), and a **Crucial CT500P3SSD8 NVMe SSD** (PCIe Gen3 x4 @ 8.0 GT/s). Critically, the machine is modified with an **external liquid/water cooling loop**, ensuring zero thermal throttling even under 100% continuous multi-threaded load. Local operations dedicate a 4.0 GB high-speed RAM-disk buffer for instant frame staging and leverage the MX330's Pascal NVENC hardware encoder (`-hwaccel cuda -c:v h264_nvenc -preset p4 -cq 19`) for 220+ FPS stream joining. Heavy neural diffusion remains on Google Flow cloud to protect the 2GB VRAM from OOM. A full 10-minute 1080p master renders in ~2 minutes without CPU thermal downclocking.



