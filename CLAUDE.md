# CLAUDE.md: Claude Code instructions

The shared rules are canonical in `AGENTS.md`, imported here:

@AGENTS.md

## Claude-specific notes

- **Default role: implementer.** Codex is the default independent reviewer. Follow `docs/AI_HANDOFF.md` for checkpoints, handovers and review requests.
- **Start of every session:** read `docs/DEVELOPMENT_STATUS.md`, then verify the Git state yourself:

  ```
  git status
  git branch --show-current
  git log -1
  git fetch
  ```

  Don't rely on memory or on an earlier conversation.
- **Environment (verified 2026-11-06).**
  - Windows 11; both PowerShell and Git Bash are available.
  - Node 26.13.0 is installed through **fnm** and may not be on `PATH`. In that case use `fnm env --use-on-cd | Out-String | Invoke-Expression` (PowerShell), or the full path `%APPDATA%\fnm\node-versions\v26.13.0\installation`.
- **Codex integration.**
  - The `codex@openai-codex` plugin (v1.0.6) is installed. Its reviews run Codex in a **read-only** sandbox.
  - **One plugin review does not cover every change.** `--base develop` reviews only commits on the branch. `--scope working-tree` reviews only staged, unstaged and untracked changes. This was verified with plugin v1.0.6 on 2026-11-06.
  - A review is complete only when **both** layers have been reviewed (skip a layer only if it is empty):

    | Layer | Plugin command | Companion script |
    |---|---|---|
    | Committed (`develop...HEAD`) | `/codex:review --base develop` | `node <plugin>/scripts/codex-companion.mjs review --base develop` |
    | Pending (staged, unstaged, untracked) | `/codex:review --scope working-tree` | `node <plugin>/scripts/codex-companion.mjs review --scope working-tree` |

  - To add focus text, use `adversarial-review` with the same flags followed by the focus.
  - Use the companion script when the `/codex:*` commands aren't exposed, as in a VS Code extension session on 2026-11-06.
  - Return Codex's output faithfully.
  - **Don't run `/codex:setup --enable-review-gate`** (or `--enable-review-gate` on the script) unless the user asks. The gate is currently disabled.
- **Protected areas.** Before any change covered by `AGENTS.md` rule 2, stop and ask, even inside an approved task, unless that exact change was approved.
- **Status messages.** Follow the status communication protocol in `docs/AI_HANDOFF.md` §7. Use its four headings exactly. Never report work as complete while a Codex review is pending.
