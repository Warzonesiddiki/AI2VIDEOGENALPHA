# OpenCode Agent Workflow & Automation Guide — Ternfall Studio

OpenCode is an optional, external CLI agent that can automate routine drafting, canon verification, and pipeline monitoring through Ternfall Studio's safe `studio` CLI interface.

## 1. Setup & Launch

1. In WSL2 or Linux terminal inside the repository root:
   ```bash
   npm install -g opencode
   cd ~/ternfall-studio
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
   The agent writes a new version to `./data/production_root/projects/<projectId>/episodes.json` with an incremented version number, leaving the prior version intact.
5. **Request Human Editorial Sign-Off**:
   The agent cannot mark an episode approved without human confirmation.

## 4. Security & Blocked Actions

Per `opencode.json` and Master Project Rules, the following are strictly blocked:
- Public publishing to YouTube (strictly human-only via YouTube Studio).
- Increasing spend caps or self-issuing spend approval grants.
- Writing outside the authorized `./data/production_root/` folder.
- Accessing or echoing credentials.
- Deleting projects or canon ledgers.

## 5. Troubleshooting WSL & CLI

- **Spaces in Windows Paths**: Always use Linux-native paths inside WSL (e.g. `/home/user/ternfall-studio`) rather than mounted `/mnt/c/Users/...` for optimal filesystem performance.
- **Port 3000 In Use**: If port 3000 is occupied, set `PORT=3001` before starting the server.
- **Permission Denied**: Check permissions on `./data/production_root`:
  ```bash
  chmod -R u+rw ./data/production_root
  ```
