# Command: /episode-draft

Draft full spoken narration for an episode adhering to 15-minute pacing (2,100–2,400 words at 140–160 WPM).

## Execution Steps:
1. Fetch target episode card:
   ```bash
   npm run studio -- episode show $EPISODE_ID --json
   ```
2. Draft spoken narration incorporating 9-beat anchor structure.
3. Validate spoken word count & pacing:
   - Must be between 2,100 and 2,400 words for standard ~15:00 runtime.
4. Run canon invariant check:
   ```bash
   npm run studio -- episode check $EPISODE_ID --json
   ```
5. Save new version and request human editorial review.
