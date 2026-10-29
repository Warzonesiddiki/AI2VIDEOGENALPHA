# Command: /episode-produce

Run supervised autoproduction pipeline on an approved episode card.

## Execution Rules:
- An explicit, human-issued `--approval-id` is REQUIRED.
- The command CANNOT publish publicly or schedule without separate interactive confirmation.

## Execution Steps:
1. Verify system readiness:
   ```bash
   npm run studio -- doctor --json
   ```
2. Trigger supervised production:
   ```bash
   npm run studio -- episode produce --episode $EPISODE_ID --profile supervised --approval-id $APPROVAL_ID --json
   ```
3. Monitor pipeline status:
   ```bash
   npm run studio -- run status $RUN_ID --json
   ```
4. Output tailored Studio upload runbook for the human operator.
