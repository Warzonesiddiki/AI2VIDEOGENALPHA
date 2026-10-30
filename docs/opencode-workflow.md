# OpenCode Agent Workflow & Automation Guide — Ternfall Studio

OpenCode is an optional, external CLI agent that can automate routine drafting, canon verification, and pipeline monitoring through Ternfall Studio's safe `studio` CLI interface.

## 1. Setup & Launch

1. In WSL2 or Linux terminal inside the repository root:
   ```bash
   cd ~/ternfall-studio
   # Install and configure your chosen agent separately after reviewing its source and terms.
   ```
2. Check that the studio CLI is responding:
   ```bash
   npm run studio -- doctor --json
   ```
3. Launch OpenCode:
   ```bash
   opencode
   ```

## 2. Model & Privacy Boundaries

- **Separation of Models**: OpenCode's reasoning model, the Google AI Studio Build coding agent, and Ternfall Studio's runtime media models (Gemini 2.5 Flash, Nano Banana 2.1, Omni Flash 1.1, Chirp 3) are completely separate systems with separate keys, quotas, and terms.
- **Data Egress**: Prompting an external model sends selected code and story context off the PC. Never include `.env` secrets, API keys, or private financial credentials.
- **Local Fallback**: If full air-gapped confidentiality is required, configure OpenCode to point to an approved local Ollama/vLLM model endpoint.

## 3. How Agents Execute Workflow Steps

Agents in this repository are instructed by `AGENTS.md` and `.opencode/agents/` to use only typed `studio` commands:

1. **Read Story Context**:
   ```bash
   npm run studio -- series list --json
   npm run studio -- episode show S01E001 --json
   ```
2. **Audit Canon & Continuity**:
   ```bash
   npm run studio -- continuity report --json
   ```
3. **Verify Distinctness**:
   ```bash
   npm run studio -- episode check S01E001 --json
   ```
4. **Draft or Update Scripts**:
   Use `npm run studio -- episode update-script <episode-id> --file <path> --json` to create a draft version. Do not edit JSON or SQLite internals; SQLite is authoritative after import. The command mutates metadata and requires the operator’s request.
5. **Request Human Editorial Sign-Off**:
   CLI `episode approve` is disabled. A local script review marker is not independent editorial, rights, spend, technical or publication approval.

## 4. Security & Blocked Actions

`AGENTS.md` prohibits the following. The repository configuration expresses intent but is not proof that a particular external agent/version enforces every restriction:
- Public publishing to YouTube (strictly human-only via YouTube Studio).
- Increasing spend caps or self-issuing spend approval grants.
- Writing outside the authorized `./data/production_root/` folder.
- Accessing or echoing credentials.
- Deleting projects or canon ledgers.

## 5. Troubleshooting WSL & CLI

- **Spaces in Windows Paths**: Always use Linux-native paths inside WSL (e.g. `/home/user/ternfall-studio`) rather than mounted `/mnt/c/Users/...` for optimal filesystem performance.
- **Port 3000 In Use**: If port 3000 is occupied, set `PORT=3001` before starting the server.
- **Permission Denied**: Inspect the specific path and ownership without recursively changing permissions. Ask the operator before altering production data or its permissions.

## 6. Reviewed project skills

The [skill catalog](../.opencode/skills/README.md) documents the project-specific and pinned upstream skills, licenses, runtime check and limits. Restart an existing OpenCode session after changing configuration. The checked `opencode.json` uses OpenCode 1 permissions; validate its behavior and effective agent rules on the actual installed version. Skills and command globs are not an OS sandbox.
