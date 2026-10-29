# Requirements Traceability Ledger

**Project:** Ternfall Studio (2D Animated Survival Thriller Video Production Studio)  
**Date:** 2026-10-29  

| Req ID | Source Section | Priority | Requirement Summary | Implementation File | Verification Test / Evidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-01** | Master Rules #1 | P0 | Local-first persistence, series/episode storage, atomic writes | `server/storage.ts` | Tested atomic writes & project persistence across restarts | **PASS** |
| **REQ-02** | Master Rules #4, Matrix 15 | P0 | Durable job states (`queued` through `cancelled`) & remote states (`unknown_external_effect`) | `src/core/jobs.ts`, `src/types/index.ts` | `src/core/jobs.test.ts` (3/3 passing) | **PASS** |
| **REQ-03** | Master Rules #7, #11 | P0 | Atomic spend authorization, per-run/episode/monthly caps, unknown cost ceiling check | `src/core/budget.ts` | `src/core/budget.test.ts` (3/3 passing) | **PASS** |
| **REQ-04** | Master Rules #10, Bible 09 | P0 | Original zombie-survival fiction series (*The Quiet Hours: Ternfall*), 10 seasons / 100 arcs / 1,000 episodes | `server/seedData.ts`, `src/components/RoadmapView.tsx` | All 100 arcs loaded and expandable (max 20 cards) | **PASS** |
| **REQ-05** | Prompt 02, Matrix 15 | P0 | Factual research vs fictional lore, SSRF defense, prompt injection shield | `src/core/sources.ts`, `src/components/ResearchRoomView.tsx` | `src/core/sources.test.ts` (2/2 passing) | **PASS** |
| **REQ-06** | Prompt 02, Rules #3 | P0 | Word count calculation, 140-160 WPM pacing (15 min ~2,175 words), distinctness check | `src/core/rules.ts`, `src/components/ScriptEditorView.tsx` | `src/core/rules.test.ts` (5/5 passing) | **PASS** |
| **REQ-07** | Prompt 03, Rules #8 | P1 | Storyboard breakdown, 2D limited animation labels, multi-stem audio ducking, SRT/VTT safe zones | `src/core/captions.ts`, `src/components/ScenePlannerView.tsx` | Safe margins checked for 16:9 Long & 9:16 Shorts | **PASS** |
| **REQ-08** | Prompt 04, Rules #6 | P1 | Doctor diagnostics, honest cloud preview vs local Windows/WSL detection, credential redaction | `server/storage.ts`, `src/components/DoctorView.tsx` | `GET /api/doctor` returns explicit runtime status | **PASS** |
| **REQ-09** | Prompt 05, Runbook 12 | P0 | YouTube upload handoff, strict `status.privacyStatus=private` default, altered content disclosure | `src/components/YouTubeView.tsx` | 10-point preflight checklist and Studio Runbook | **PASS** |
| **REQ-10** | Integration Prompt 11 | P0 | Resumable end-to-end autoproducer wizard with supervised profile and spend approval ID | `src/components/AutoproducerView.tsx`, `server/routes.ts` | 12-stage pipeline visualizer and stage advancement | **PASS** |
