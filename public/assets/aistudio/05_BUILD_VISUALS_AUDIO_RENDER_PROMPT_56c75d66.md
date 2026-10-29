# BUILD PROMPT 3 — Storyboard, original art, voice, audio, render

Run only after Story Room persistence and tests pass. Follow `14_AI_STUDIO_FLASH_EXECUTION_PROTOCOL.md` and the relevant provider/media rows in `15_END_TO_END_FAILURE_AND_RECOVERY_MATRIX.md`: inspect the current repository, give a concise plan and acceptance-test map, implement only this phase, run the relevant checks, and report actual evidence. Keep every working phase intact; do not ask the Build agent to change models.

---

Implement the **Visual & Audio Production** pipeline for Ternfall Studio, following `02_MASTER_PROJECT_RULES.md`. Create a real scene-to-render workflow with honest provider capability detection. Do not label a slideshow or static frame as full animation, and do not create fake generated media when no provider is configured.

## Workflow

`Approved Script → Scene Breakdown → Storyboard → Art/Reference Review → Image/Clip Generation → Voice & Audio → Timeline Assembly → Render → Technical QC → Human Editorial QC → Export Package`.

A changed approved script must mark dependent scene prompts, voice tracks, captions, and renders stale. The user can regenerate only selected scenes, not rerun an entire episode by accident.

## Scene/shot model and editor

Each scene/shot must have stable IDs, source script lines/beat anchors, duration target, scene purpose, framing/composition, POV, character/location reference IDs, time/weather/lighting, foreground/background, action, visual prompt, negative constraints, aspect-ratio crop, animation method, transition, narration timecode, caption safe region, generation status, source/provider/model, cost, retry history, and rights/provenance.

Implement:

- A scene list/storyboard view with thumbnails, prompt editor, reference controls, filters, drag/reorder, duplicate-as-new-variant, and stale/missing-asset badges.
- A detailed editor for shot duration, camera move, character motion, environmental motion, transition, background music/SFX, captions and narration timing.
- Character/location reference sheets with one approved canonical reference per version and a visible history; never use a competitor or manhwa panel as a reference asset.
- A media-bin browser with provenance/rights fields, duplicate detection, preview and relink controls.
- A timeline/sequence assembly that can work using stills and limited animation while making the method explicit.

Do not force one image per sentence. Create scene-length beats driven by the narration and use an adjustable target (for example, 80–120 purposeful shots for a 15-minute illustrated episode as a starting estimate, then let actual pacing determine the result). The count is not a quality target. Mix establishing shots, character close-ups, maps/diagrams, prop details, quiet reactions, location changes, and major action beats.

## Provider integration and cost gates

Create capability-based adapters for:

- Still image generation/editing
- Image-to-video/text-to-video clips
- Text-to-speech/voice generation
- Speech transcription/alignment
- Licensed/original music and sound effects (include manual import)

Start with one provider integration only when the current official API is verifiable. Use Gemini API server-side for supported capabilities if selected; keep model names, dimensions, duration limits, accepted reference inputs, and prices in configuration/metadata and verify them against current documentation. Do not use private web endpoints, undocumented third-party wrappers, or user-facing “free” claims.

Before a paid batch, calculate a conservative estimate when pricing is known (number of images, video seconds, voice characters/minutes, retry allowance). If price is unknown, show “cost estimate unavailable—set a manual maximum and confirm.” Require user approval and pause when a budget/call limit is reached. Support cancellation, bounded retries, exponential backoff for transient errors, and idempotency keys so a retry does not accidentally double-charge.

Before the first call to each provider and whenever its tier/terms materially change, show the provider/account tier, the exact input classes/files sent off-device, current data-use/training and retention terms, a link and checked date, and estimated cost/uncertainty. Obtain explicit operator consent; provide a provider-off switch and manual/local import path. Do not promise zero retention, that generated assets are exclusive, or that a provider grants commercial rights—record the applicable provider terms and require the operator to review commercial-use/voice/likeness permissions. Never send secrets or confidential/personal/sensitive data without explicit authorization.

Secrets stay server-side or in an approved local secure store. Redact requests, API keys, OAuth tokens and private user data from logs. A failed provider must leave existing approved assets untouched.

## Dated Google API reference profile — verify live before implementation

The operator expects the **AI Studio Build coding agent** to remain its current default/latest Flash model. The model names below are candidates for the app's **runtime media services**, not a request to change the coding agent. The user must confirm providers, tier and budget during onboarding.

Checked 29 October 2026 against Google's official Gemini API model/pricing pages:

- **Image candidate:** `gemini-nano-banana-2.1` for image generation/editing via the documented Interactions API. The pricing page currently lists indicative output costs of about US$0.0336 per 1K image, US$0.0504 per 2K and US$0.113 per 4K; check current tier, prices and model availability before making a paid call.
- **Video candidate:** stable Gemini Omni Flash, model ID `gemini-omni-1.1-flash`, via the documented Gemini Interactions API. Current model documentation lists 3–10-second output clips at 24 FPS, with 360p/720p/1080p/4K settings; the default is 720p. The current Gemini API pricing page shows no free tier and about US$0.10 per generated second of 720p video. Do not implement the retired Gemini API preview IDs `veo-3.1-generate-preview`, `veo-3.1-fast-generate-preview` or `veo-3.1-lite-generate-preview`: Google says they shut down 22 October 2026. If using a different Google Cloud/Agent Platform route, verify its separate current endpoint, ID, account entitlement, costs and terms first.
- **Voice candidate:** Google Cloud Text-to-Speech is a separate API and account setup from Gemini media generation. Its current pricing page lists Chirp 3: HD with up to 1 million characters free and US$30 per million thereafter. Gemini 3.8 Flash TTS is currently Preview and has separate token-based pricing that changes on 1 January 2027. Do not treat a preview price, language/voice availability, or the Gemini API key as proof that Cloud TTS is configured. Audition the actual voice and confirm its language, pronunciation, account/region and rights before generating narration.
- **Duration/cost arithmetic:** a 15-minute master is 900 seconds. Generating every second as 720p Omni video at the current approximate rate would be about US$90 per episode before retries, other modalities, storage, taxes or higher-resolution costs; at ten episodes/day it would be about US$900/day for video seconds alone. At the current 10-second maximum, even a no-retry all-video episode requires at least 90 clips. This is an estimate, not a vendor quote or guarantee; use the live price and exact shot plan in the app's approval screen.

The media workflow must assemble short approved shots, narration, still/limited-animation sequences, captions and sound into a real full-length rendered episode; no model call is assumed to produce a 15-minute finished episode. Offer an illustration-first motion-comic profile and optional generated-video highlights/full-video profile with separate estimates. The operator chooses the profile and caps. Never silently substitute stills for requested generated video because a provider is unavailable or over budget; block with the reason and offer an explicitly chosen alternative. If pricing or the API route cannot be verified, leave the adapter unconfigured and provide real manual import instead of guessing.

## Honest fallback and 2D pipeline

If AI video is unavailable or too expensive, offer a **real limited-animation path** based on approved illustrations: 2D pan/zoom, layered parallax where layers exist, controlled camera motion, opacity/lighting animation, simple mask/shape motion, and chapter cards. Label each shot’s technique. If a scene has only a still and no motion, show “still frame with camera motion” rather than “AI animation.”

Video-model clips are optional highlights, not mandatory for every shot. Do not extrapolate clip durations or resolution silently; validate returned media and ask the producer to approve the selected take.

## Voice, captions and audio rights

- Let the creator select an original licensed voice, set narration speed/style, add pronunciation notes, and audition short text before generating the episode. Do not impersonate a real person or clone a voice without documented consent and rights.
- Preserve script text ↔ audio take ↔ subtitle version relationships. Allow line-level re-recording and audio replacement.
- Generate editable SRT and VTT from approved narration and actual audio timing. Detect clipping, silence gaps, unexpected duration drift, missing audio, and caption lines that exceed configured readability limits.
- Track rights/consent and source for every TTS voice, song, ambience, sound effect, stock clip, and imported file. A user checkbox cannot replace a license; missing provenance blocks commercial export until reviewed.
- Audio mix: separate narration/music/SFX stems, duck music under speech, configurable loudness target, peak limiter, fade controls, and a pre-render audio preview. Do not hard-code a claim that the result meets platform loudness requirements without measurement.

## Rendering implementation

- Detect FFmpeg and FFprobe, show exact executable/version, and provide Windows/WSL setup guidance. Allow the user to configure the binary path securely.
- Render using FFmpeg with argument arrays (no shell interpolation), temporary intermediate files, progress parsing, cancellation, atomic finalization, detailed stderr logs, and cleanup only for files the app created.
- Provide validated export presets:
  - Long-form: 16:9, default 1920×1080, H.264 MP4 with AAC audio; configurable frame rate/bitrate.
  - Shorts: 9:16, default 1080×1920, H.264 MP4 with AAC audio, under the current Shorts length ceiling; titles/captions inside safe margins.
- Support alternate resolutions/frame rates only after probing; calculate duration from final video, not script estimate.
- Use FFprobe to validate dimensions, duration, codec, pixel aspect, audio stream, frame rate, file size and metadata. Check for missing/black frames where practical, audio clipping, unreadable captions, blank output and mismatched aspect ratio. A failed validation cannot be marked passed by the AI.
- Keep project render settings/version and input hashes in a reproducibility manifest; never overwrite a previous approved export unless the user explicitly versions/replaces it.

## Editorial and policy review gates

Before a render can be marked “ready for publish,” require human review of the full video or a structured scene preview, script/sources, visual consistency, rights, music, captions, title/thumbnail, audience suitability, and platform-specific altered/synthetic-media disclosure. The tool can flag issues; it cannot certify “monetizable,” “copyright-safe,” or “viral.”

## Tests and completion gate

- Test prompt generation and shot validation with deterministic fixtures, not fake production media.
- Test no provider configured, bad key, timeout, rate limit, invalid image, unsupported format, cost cap, cancellation, retry, partial success, script change invalidation, and missing local file.
- Test actual FFmpeg render in CI/local smoke tests when FFmpeg is available; otherwise report the skipped test and exact prerequisite, never call it passed.
- Render a small, clearly labeled test sequence using project-owned sample art; validate with FFprobe and inspect the output.
- Verify SRT/VTT timing, 16:9/9:16 dimensions, process-safe path handling, and no credential leakage. Test provider data/retention notice and consent, rejection/cancellation before any network call, stale policy notices, and missing commercial-rights evidence.
- Run all project checks and report exact output and remaining limitations.
