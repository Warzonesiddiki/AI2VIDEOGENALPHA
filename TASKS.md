# TASKS.md — Project Ledger & Live Execution Tracker

**Single Source of Truth Reference**: `PROJECT_SPEC.md`  
**Universal Definition of Done**:
- [x] All states handled: loading, empty, error, success, and edge/offline states
- [x] Every input validated (client AND server where applicable)
- [x] Every external call has error handling
- [x] Responsive layout at desktop/laptop
- [x] Basic accessibility: labels, keyboard nav, visible focus, contrast
- [x] Nothing sensitive exposed client-side
- [x] Verified by ACTUALLY RUNNING IT (unit tests + browser verification)

---

## P0 — Blocking (Core Pipeline & Automation Engine)

- [x] **Task P0.1**: Build Resumable Batch Checkpoint Engine in `src/core/flow.ts` & Server API
  - *Spec Link*: Feature 2 & Feature 3
  - *DoD*: Saves/loads checkpoint state for 600 batches, resumes from last unverified frame without duplicating work.
- [x] **Task P0.2**: Implement Single-Click "Autoproduce Full Master" Orchestrator in `src/core/flow.ts` and CLI
  - *Spec Link*: Feature 8
  - *DoD*: End-to-end automation runner (`Plan -> Worker Verify -> Audio Synthesize -> Video Render -> Shorts Cut -> YouTube Package`) callable via `POST /api/projects/:id/flow/autoproduce/:epId` and CLI `npm run studio -- flow autoproduce`.
- [x] **Task P0.3**: Write Unit Tests in `src/core/flow.test.ts` for Checkpoint & Autoproduce Orchestrator
  - *Spec Link*: Acceptance Criteria 2 & 8
  - *DoD*: 100% test pass on node:test runner verifying error recovery, checkpoint resumption, and pipeline sequencing.

---

## P1 — Important (UI Player, Pre-Flight QC & Storage Controls)

- [x] **Task P1.1**: Build Integrated HTML5 Video Player with 9-Beat Chapter Scrubbing in `GoogleFlowView.tsx`
  - *Spec Link*: Feature 6
  - *DoD*: Embedded video player in Studio UI with clickable chapter buttons that scrub to exact beat timestamps (00:00, 01:30, 03:00, etc.).
- [x] **Task P1.2**: Implement YouTube Pre-Flight Technical Quality Control (QC) Card
  - *Spec Link*: Acceptance Criteria 5 & 7
  - *DoD*: Real-time audit checklist verifying: 1080p resolution, 24fps frame rate, -14.0 LUFS loudness, 0 dropped frames, rights clearance, and synthetic media disclosure.
- [x] **Task P1.3**: Implement Local Storage & Disk Cleanup Manager in `GoogleFlowView.tsx`
  - *Spec Link*: Feature 3 & Missing Pieces #6
  - *DoD*: Shows live disk usage (frame count, size in MB/GB), with 1-click "Clean Temporary Renders" and "Export Archive".

---

## P2 — Polish (Workflow Enhancements & Account Health Diagnostics)

- [x] **Task P2.1**: Account Health & Session Status Checker for 3 Pro Accounts in UI
  - *Spec Link*: Missing Pieces #1
  - *DoD*: Live status indicator (Active, Expired, Testing) with token config modal.
- [x] **Task P2.2**: Full End-to-End Visual Browser Verification & Adversarial Hardening
  - *Spec Link*: Phase 6 & Ultra-Mode Checklist
  - *DoD*: Browser validation via `playwright-cli`, testing happy path, rapid clicking, tab switching, and empty states.
