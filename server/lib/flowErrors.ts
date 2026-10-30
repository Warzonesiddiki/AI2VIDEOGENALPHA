/** Fixed public messages for expected Flow planning and file-verification failures. */
export const flowRequestErrors = {
  FLOW_INVALID_IDENTIFIER: 'Invalid identifier.',
  FLOW_INVALID_REVISION: 'Revision must be a nonnegative safe integer.',
  FLOW_INVALID_PAGE: 'Invalid batch page.',
  FLOW_PAGE_BEYOND_PLAN: 'Batch page starts beyond the plan.',
  FLOW_INVALID_DURATION: 'Duration must be an integer between 1 and 900 seconds.',
  FLOW_INVALID_FPS: 'FPS must be an integer between 1 and 60.',
  FLOW_INVALID_MODE: 'Invalid Flow mode.',
  FLOW_STALE_PLAN: 'Plan source is stale or unknown; replace the plan before using its checkpoint.',
  FLOW_UNSUPPORTED_CLAIMS: 'Simulation and caller-supplied filename claims are not accepted. Place actual frames in the episode render directory.',
  FLOW_EPISODE_OR_PLAN_NOT_FOUND: 'Episode or plan not found.',
  FLOW_LEGACY_SOURCE: 'Legacy plan has no source episode revision; replace the plan before verifying.',
  FLOW_BATCH_NOT_FOUND: 'Batch not found.',
  FLOW_LEGACY_BATCH: 'Legacy plan has incompatible batch sizes; regenerate it using the current revision.',
  FLOW_FRAME_MISSING: 'One or more required frame files are missing. Place the supplied PNGs in the episode render directory and verify again.',
  FLOW_FRAME_INVALID: 'A required frame is invalid or could not be decoded as a single 1920x1080 PNG. Inspect the supplied PNGs and verify again.',
} as const;
export type FlowRequestErrorCode = keyof typeof flowRequestErrors;

export class FlowRequestError extends Error {
  constructor(public readonly code: FlowRequestErrorCode) { super(flowRequestErrors[code]); }
}
