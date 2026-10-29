# Command: /episode-plan

Plan a new episode card from approved canon for *The Quiet Hours: Ternfall*.

## Execution Steps:
1. Fetch latest continuity status:
   ```bash
   npm run studio -- continuity report --json
   ```
2. Check existing episode roster:
   ```bash
   npm run studio -- episode list --json
   ```
3. Propose a unique physical objective, dramatic question, human conflict, and consequence.
4. Verify non-similarity against prior episodes using `studio episode check`.
