---
name: ternfall-opencode-config
description: Configure and validate project-local OpenCode agents, skills and permissions against the installed runtime.
---

# Ternfall Opencode Config

1. Read the runtime version's actual configuration and skill discovery documentation; schema versions can differ. Validate with `opencode debug config`, `opencode debug skill` and effective agent permissions when available.
2. Use explicit agent descriptions and review tool permission ordering; agent-specific rules can override global rules. Default edit and shell actions to operator approval.
3. Do not assume textual policy, globs, a config file or a skill is a security sandbox. Verify on the target machine and protect secrets separately.
4. Restart an existing OpenCode session after changing configuration. Do not download or execute an unreviewed installer; keep runtime/provider consent separate from skill discovery.
