# BUILD PROMPT 5 — YouTube packaging, review, upload queue and analytics

Run only after the story, media, local CLI and persistence paths exist. Follow `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and the YouTube/OAuth rows in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`: inspect the repository, state the bounded phase plan and acceptance tests, then implement and verify this phase. Read current official YouTube API and Help documentation before implementing; platform fields, quotas, OAuth scopes, upload rules and monetization terms change. If official docs cannot be checked, leave the integration blocked rather than guessing. Do not ask the Build agent to change models.

---

Implement the **YouTube Operations** module for Ternfall Studio, following `02_MASTER_PROJECT_RULES.md`. It must prepare, validate, queue and—only when explicitly authorized—upload original video packages. Do not scrape YouTube Studio or automate browser clicks.

Official references to verify at implementation time:

- YouTube Data API `videos.insert`: <https://developers.google.com/youtube/data/reference/rest/v3/videos/insert>
- OAuth installed-app flow (local Windows): <https://developers.google.com/youtube/v3/guides/auth/installed-apps>
- OAuth web-server flow (hosted mode only): <https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps>
- YouTube Studio upload workflow: <https://support.google.com/youtube/answer/57407?hl=en>
- YouTube monetization/inauthentic-content policy: <https://support.google.com/youtube/answer/1311392?hl=en>
- Altered/synthetic-content disclosure: <https://support.google.com/youtube/answer/14328491?hl=en>
- Shorts duration/music guidance: <https://support.google.com/youtube/answer/15424877?hl=en>
- Current YPP eligibility and updates: <https://support.google.com/youtube/answer/13429240?hl=en> and <https://support.google.com/youtube/answer/12843009?hl=en>

## Content packages

For each approved episode, build a versioned package with:

- Long-form MP4 path, actual duration, resolution/aspect ratio, caption files and technical QC.
- Zero or more separately edited Shorts, each with its own hook/context/payoff, title/description, 9:16 export, actual duration and caption review. A Short must meet the current platform length/aspect-ratio rules. Do not simply issue ten near-identical crops from one long video.
- Title options, description, chapter timestamps, playlist/series position, tags only when useful, thumbnail, caption language, audience setting, license/rights checklist, source links, and internal episode references.
- Metadata must match what is actually in the video. Never fabricate survival facts, urgency, real events, real-person claims, footage provenance, or “based on a true story” statements.
- A clearly marked draft recommendation for whether altered/synthetic-media disclosure needs review. Record who made the final decision, which current policy page/date was checked, and whether the current YouTube Studio workflow supports that field. Do not assume all AI-generated animation must be disclosed or none needs disclosure.

## Preflight review gate

Create a required, dated checklist before any upload:

1. Final file is present and passes FFprobe/technical QC.
2. Script, sources, factual claims and fictional disclaimers reviewed.
3. Character/asset/music/voice rights and any consent records checked.
4. Title, thumbnail, description, chapters and audience selection match the actual video and are not misleading.
5. Copyright/Content ID risk reviewed, especially third-party music and Shorts over one minute.
6. Current platform/advertiser/age-suitability rules checked; an AI flag is a reminder, not legal advice.
7. AI/altered-content disclosure reviewed in YouTube Studio; if uncertain, hold the upload for manual review.
8. User selects channel, visibility, date/time, playlist and final confirmation.
9. Scheduling stays disabled until the operator explicitly selects and confirms an IANA timezone; do not silently assume **Asia/Kolkata**. Persist timezone-aware timestamps, handle daylight-saving rules where relevant, and display the selected local time clearly before approval.
10. A person explicitly approves the upload itself. Keep unsubmitted content as a local draft; when the Data API is used, set privacy to private by default. Require a separate human approval before making it public or scheduling it. Upload errors never trigger a public retry without a new approval.

## OAuth, upload and privacy

- Use the documented YouTube Data API and OAuth 2.0. Request the least privilege needed: request only `youtube.upload` for uploads; add read/analytics scopes only when that feature is explicitly enabled. For the local Windows app, use the current supported installed-app flow with the system browser, a loopback redirect and PKCE; for a hosted web app, use the documented server-side web flow. Never embed a client secret in browser code or a distributed desktop app. Validate OAuth `state`, redirect URI, callback origin and granted scopes; handle user denial, revoked consent, expiry, refresh failure and account/channel switching. Explain Cloud project, OAuth consent/verification, test-user, scope and client-configuration requirements before connection. Encrypt local refresh tokens with an OS-protected credential store (or an equivalently protected store); never store them in project backups/exports. Provide disconnect/revoke and reauthorization flows.
- Treat Google Cloud API quota and YouTube channel daily upload limits as separate constraints; read current values from official sources and the selected project/channel rather than hard-coding. **Handle conflicting official docs explicitly:** the current `videos.insert` reference says unverified projects are not restricted to private viewing, while the API revision history and YouTube Help still describe private locks for unverified API services. Do not hard-code either conclusion. For each API upload, explicitly send `status.privacyStatus=private`—never omit it, since the current method reference says omission can default to public—then read the returned status, reconcile it with YouTube Studio, and show the result. Provide manual Studio handoff if public API publishing is not proven for this project. Check current YouTube API audit requirements and Google OAuth app verification requirements separately before promising public automation.
- Credentials stay server-side/local and encrypted/protected at rest; never return access/refresh tokens to the browser or log them. Include a “disconnect/revoke” path and masked status.
- If the current API does not expose a required disclosure/audience/monetization field, leave it for manual YouTube Studio review; do not spoof or claim it was set.
- Support resumable uploads where current API allows them, byte-level progress, pause/cancel/retry, server response ID, and a safe recovery path after a timeout. Idempotency must prevent duplicate public uploads; if the API status is unknown, query/reconcile before retrying.
- Keep unsubmitted content packages in local draft state. If an API upload is approved, upload as private by default; public visibility or scheduling requires a second explicit approval. Do not auto-publish a large queue, bypass upload caps, use multiple channels to evade rules, or schedule an unreviewed mass batch.
- Enforce user-configurable daily caps and minimum spacing with an audit record. Defaults must match the pilot cadence in `01_RESEARCH_AND_OPERATING_PLAN.md`; raising a cap requires explicit user confirmation.

## Manual upload guide / upload-ready handoff

Implement this as a first-class route, not a generic help link. Use `12_YOUTUBE_UPLOAD_RUNBOOK.md` as the baseline manual workflow, and generate a saved, per-video checklist from the actual export/package:

- Show the exact local master/Short filename, duration, dimensions, caption file, thumbnail, title, description, language, playlist suggestion, and factual/rights notes.
- Give the operator the current Studio path (sign in → confirm channel → Create → Upload videos → select file → Details → Video elements/captions → Checks → Visibility → Save/Publish/Schedule). Tailor steps for long-form versus Short and for any missing field or unsupported API operation.
- Clearly distinguish **local package**, **uploaded/private**, **unlisted**, **scheduled**, and **public**. Never label a file uploaded before YouTube returns a real video ID and the app has reconciled actual status.
- Ask the operator to choose audience, altered/synthetic disclosure, visibility, schedule/timezone, notifications, and final publish. Use checkboxes for documented actions, not a button that claims to complete actions the app cannot perform.
- Provide official links to the current Studio upload, Shorts, thumbnail, audience, and altered/synthetic-content guidance; record when these references were last checked and warn when stale.
- Keep this Studio walkthrough available if OAuth is disconnected, API upload is unsupported, project behavior is unresolved, or the user prefers manual control. Never scrape the Studio page or automate browser clicks.

The user-facing fallback is documented in `12_YOUTUBE_UPLOAD_RUNBOOK.md`. Update that file if the official workflow changes; do not bury the upload sequence only in a prompt or in an undocumented UI.

## Analytics

- Use only authorized YouTube Analytics/Data APIs or user-provided exports. Store fetch time, date range, video ID, metric definitions, source, and API version.
- Build a dashboard for long-form and Shorts separately. Display only metrics actually available from API/report: impressions/click-through where supported, views or engaged views with their definition, average view duration/percentage, watch time, audience retention segments where supported, subscribers gained, shares/comments, estimated revenue only if authorized/available, and upload cost/margin.
- Show sample size/date range and avoid over-interpreting noisy early data. Do not promise that any metric directly controls recommendation ranking.
- Let the showrunner compare episode-level premise/format/thumbnail/version to performance, while preventing analytics from automatically rewriting the series into identical high-clickbait templates.
- Import/store comments only if a justified authorized endpoint and privacy policy exist. Do not generate or post fake comments, likes, views, or engagement.

## Policy/cadence dashboard

Create a configurable policy panel that stores official source URLs, last checked date, next review date, and policy notes. It must show a warning when the review date is stale and link to the official page. Never hard-code YPP thresholds or upload limits as permanent truth.

Provide a 30-day calendar that distinguishes **candidate assets**, **human-approved packages**, **private uploads**, **scheduled posts**, and **published videos**. Allow a 10-slot daily planning view if requested, but warn when the schedule exceeds the configured cap or contains near-duplicate episodes. Do not reward quantity as an internal KPI.

## Tests and completion gate

- Unit tests for metadata validation, file/QC preflight, timezones, duplicate detection, caps, approval transitions and stale policy warnings.
- Integration tests for OAuth state/PKCE/loopback callback validation, granted-scope enforcement, token encryption/revocation/refresh failure, channel switching, and rejected/expired consent using fixtures; never use real credentials in CI.
- Test upload failures and constraints: invalid scopes, expired/revoked token, API quota exceeded, separate channel upload limit, conflicting/unavailable project-audit status, request must explicitly set `status.privacyStatus=private` (never omit it), requested-versus-returned privacy mismatch, network drop before/after server response, duplicate uncertainty, missing file, private upload, manual Studio fallback, and explicit separate public approval.
- Test Shorts length/aspect ratio, long-form profile, rights fields, human disclosure decision and upload package version linkage.
- Mock API tests must be clearly test-only. No fake upload in the production UI.
- Run full tests/build; report exact results, required Google Cloud/YouTube configuration, any unsupported API fields, and manual Studio steps.
