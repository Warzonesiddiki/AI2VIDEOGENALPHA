# Assumptions & Decisions Log

**Project:** Ternfall Studio  
**Date:** 2026-10-29  

| Decision ID | Area | Safe Recommendation / Assumption | Impact | User Action Needed? |
| :--- | :--- | :--- | :--- | :--- |
| **D-01** | Production Timezone | Default set to `Asia/Kolkata` with prominent IANA selector in Settings and Calendar. | Avoids silent UTC assumption; timestamps rendered in user local time. | Confirmed via Settings dropdown. |
| **D-02** | Initial Storage Root | Defaults to `./data/production_root/` within repository for cross-platform portability. | Ensures atomic writes work in both AI Studio container and Windows/WSL. | User can override to absolute Windows path in local mode. |
| **D-03** | YouTube Upload Privacy | Strict `status.privacyStatus=private` default. | Preflight gate prevents accidental public publishing. | Human must manually promote in YouTube Studio. |
| **D-04** | Pilot Production Target | S01E001 "The Eight-Beat Failure" (2,180 words, 145 WPM, ~15:02 target runtime). | Single-pilot verification milestone before mass expansion. | Operator reviews pilot before scaling. |
| **D-05** | Media Generation Fallback | If video models are unavailable/unconfigured, pipeline labels shots as "still frame with camera move" or "limited 2D parallax". | Prevents fake video claims; keeps budget predictable. | Operator chooses between illustration or video highlights. |
