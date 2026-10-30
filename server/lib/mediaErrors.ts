/** Fixed public messages for expected local-render request failures. */
export const mediaRequestErrors = {
  INVALID_IDENTIFIER: 'Invalid identifier.',
  INVALID_RENDER_REQUEST: 'Invalid local render request.',
  INVALID_FRAME_COUNT: 'Local renders require 24–21600 frames at 24fps (1–900 seconds).',
  INVALID_AUDIO_FILE: 'Audio must be a WAV/FLAC basename inside the episode audio directory.',
  RENDER_KEY_CONFLICT: 'Idempotency key conflicts with another render.',
  RENDER_QUEUE_FULL: 'Local render queue is full.',
  RENDER_NOT_FOUND: 'Local render not found in project.',
  RENDER_ALREADY_TERMINAL: 'Render is already terminal.',
  RENDER_NOT_RETRYABLE: 'Only unsuccessful terminal jobs can be retried.',
  RENDER_CHECKPOINTS_ACTIVE: 'Checkpoint cleanup requires a terminal render.',
  RENDER_OUTPUT_UNAVAILABLE: 'No QC-verified output is available.',
  RENDER_ADJUDICATION_ATTESTATION_REQUIRED: 'Worker-claim adjudication requires explicit operator attestations that the recorded worker is stopped and this data directory is not concurrently in use.',
  RENDER_ADJUDICATION_NOTE_REQUIRED: 'Provide an evidence note of 1-2000 characters describing what was checked.',
  RENDER_ADJUDICATION_NOT_APPLICABLE: 'Only a running job with an incomparable worker claim can be adjudicated.',
  RENDER_ADJUDICATION_WORKER_LIVE: 'The claimed worker appears to still run in this process domain; stop it before adjudicating.',
  RENDER_ADJUDICATION_USE_RECOVERY: 'The claim is comparable and recoverable from process evidence; run media recover instead of adjudicating.',
} as const;
export type MediaRequestErrorCode = keyof typeof mediaRequestErrors;

export class MediaRequestError extends Error {
  constructor(public readonly code: MediaRequestErrorCode) { super(mediaRequestErrors[code]); }
}
