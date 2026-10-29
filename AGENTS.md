# Ternfall Studio — Agent & OpenCode Operating Contract

This repository contains **Ternfall Studio**, a local-first production environment for original animated survival thrillers (*The Quiet Hours: Ternfall*).

## Strict Invariants for Automated Agents

1. **Never Publish Publicly Without Human Approval**: Unattended agents MUST NEVER trigger public releases, scheduled publication, or change privacy from `private`.
2. **Never Mint or Widen Spend Approvals**: Paid generation requires an operator-issued `--approval-id` with an explicit budget cap. Agents cannot bypass or increase caps.
3. **No Competitor Copying or Manhwa Imitation**: All storylines, character names, and visual prompts must remain strictly original to the *Ternfall* universe.
4. **Use the Typed CLI (`studio`)**: Interact with project data only through `studio ... --json` commands. Never manipulate database internals directly.
5. **Path Traversal Prohibited**: All file operations must stay inside the configured project root (`./data/production_root/`).

## Safe Automation CLI Reference

```bash
# Doctor / capability health
npm run studio -- doctor --json

# List and inspect episodes
npm run studio -- episode list --json
npm run studio -- episode show S01E001 --json

# Run distinctness & hard canon validation
npm run studio -- episode check S01E001 --json

# Inspect continuity events and unresolved clues
npm run studio -- continuity report --json

# Expand a 10-episode arc (Hard cap: max 20 cards per batch)
npm run studio -- arc expand --arc 1 --count 10 --json

# Add research claim with SSRF protection
npm run studio -- research add "Low pressure mains can siphon" --url "https://en.wikipedia.org/..." --json

# Inspect autoproducer run status
npm run studio -- run status run_001 --json
```

## Agent Roles in `.opencode/agents/`

- **story-planner**: Outlines, beat anchors, and script drafting from canon.
- **continuity-reviewer**: Read-only audit of canon events, timeline drift, and character knowledge.
- **production-operator**: Runs local media generation and QC within user pre-authorized spend caps.
