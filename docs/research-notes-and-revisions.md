# Research notes: trust boundaries and revisions

Research capture is **not independent fact verification**. This workflow stores bounded source notes and original fictional lore; it does not fetch web pages, certify scientific claims or mint human review approvals.

## New notes and edits

- `GET /api/projects/:id/research` returns notes with revision tokens.
- `POST /api/projects/:id/research` creates a note; omit `id` to receive a server-generated UUID-based ID. At minimum submit a nonempty `claimText`.
- To replace an existing note, include its `id` and current `revision`. Replacements are not partial merges: include the fields you intend to retain. The server preserves the original creation timestamp when omitted.
- A successful save increments the note's revision. A stale token returns **409**, `code: "REVISION_CONFLICT"` and `currentRevision`, without overwriting the winner. Missing tokens mean legacy revision 0, not unconditional writes. Storage-level saves enforce the same protection as HTTP saves.
- `projectId` and existing creation time are protected. Unknown projects return 404 through HTTP; mismatched scope, unsupported fields and invalid inputs return 400. Caller-supplied record IDs must be valid identifiers.

Example new real-world note:

```json
{
  "claimText": "A source note requiring independent review",
  "isFictionalLore": false,
  "sourceUrl": "https://example.com/reference",
  "sourceTitle": "Reference title",
  "evidenceExcerpt": "A bounded quotation for later checking"
}
```

The typed CLI remains available for capture/listing:

```bash
npm run studio -- research add "An original note pending review" --url https://example.com/reference --json
npm run studio -- research list --json
```

There is no CLI edit command or browser merge editor yet. Automation must not edit database internals or manufacture review events.

## Review labels are not writable authority

Ordinary saves cannot assert `humanApproved: true`, `verificationStatus: "verified"`, or nonzero confidence. New real-world notes default to `unverified`, zero confidence and no human approval. Zero is an unmeasured sentinel, **not evidence that a claim is false**. Fictional lore is labeled `fictional_rule`, never real-world verified evidence; a real-world note cannot claim that classification. A disputed label can record doubt, not certify truth.

There is no durable independent review-event service yet. Historical approval/verified/confidence labels are therefore demoted on read, without rewriting the underlying stored document. Unsupported source links are suppressed and accepted URLs have embedded credentials stripped from the read representation. Metadata backups may still contain historical labels/raw links; backup is not sanitization. Saving an edited legacy note persists its current unreviewed state.

## Input checks and their limits

The shared storage/API validator bounds claim text (10,000 characters), URLs (2,048), source title/publisher (1,000 each), excerpts (30,000), checker notes (10,000), and related episode IDs (100 valid identifiers). It validates booleans, revisions, dates and supported fields. Known instruction signatures in textual fields are rejected. These pattern checks are **advisory**, not comprehensive prompt-injection protection. Untrusted notes must never become tool instructions or approval authority.

URL checks are syntax/literal-target checks only. Accepted URLs are normalized and embedded credentials removed. No HTTP fetch, DNS resolution, redirect validation or source-content verification occurs. Do not reuse this validator alone to authorize a future network-fetch feature; that needs public-address resolution, redirect revalidation and network egress controls. Entered access dates are assertions, not measured retrieval evidence.

The browser calls records source notes rather than verified facts, shows failures, keeps failed-submit drafts while the view remains mounted, bounds form fields and guards old project/URL responses. A project switch clears the project-specific draft intentionally. It has no persistent offline draft store and no browser edit/merge workflow.

## Validation and remaining work

Isolated regressions cover unreviewed defaults/zero preservation, approval spoof rejection at HTTP and storage layers, credential-free URLs, immutable identity, malformed inputs, advisory instruction rejection, legacy demotion without rewriting, stale HTTP/storage edits and simultaneous independent-process writes. They do not establish factual truth, complete prompt-injection safety, DNS-safe fetching or browser accessibility. Independent review events, editorial integration, complete legacy-data review and automated browser testing remain open.
