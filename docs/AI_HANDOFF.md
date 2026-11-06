# AI workflow and handover procedure

Rules: [`../AGENTS.md`](../AGENTS.md). Project state:
[`DEVELOPMENT_STATUS.md`](DEVELOPMENT_STATUS.md). This file covers **how work
moves**: between steps, between sessions, and between Claude and Codex.

## 1. Standard workflow

1. **Start.** Fetch, then create `feature/<topic>` from the latest `origin/develop`. Confirm the working tree is clean.
2. **Implement.** Claude by default, within the approved scope only.
3. **Self-verify:**
   - `npm test`
   - `npm run test:defects`, when known defects are involved
   - `npm run build`
   - any targeted checks

   Record the real commands and results.
4. **Request an independent review** of `develop...HEAD`, plus all staged, unstaged and untracked changes. The review is done by Codex by default and is read-only.
5. **Evaluate the findings.** Fix the ones within scope. Report any you disagree with, and why. Repeat the review if the changes were material.
6. **User approval:** first commit, then push, then the PR or merge, each approved separately. Only the user merges into `develop` or `main`.
7. **After a merge:** sync local `develop` with a fast-forward-only pull, and update `DEVELOPMENT_STATUS.md` on the next feature branch.

Roles can be swapped by the user. **Never switch assistant, or hand work over, without the user's authorisation.**

## 2. Usage thresholds and checkpoints

There are two separate limits; keep them apart.

- **Context window:** how much of the current session's working memory is used up. It is per session; a fresh session resets it.
- **Account usage limit:** rolling quota across sessions. Hitting it can stop *any* session mid-task.

Use the tool's own indicator if it exists (for example Claude Code's `/context`, or Codex's status display). **Never estimate or invent a percentage.** If no reliable figure is available, write a checkpoint at every meaningful task boundary and before any large or risky change.

| Context or usage consumed | Action |
|---|---|
| 0–69% | Normal development. |
| 70–80% | Write a **checkpoint** (§3). |
| 80–85% | Finish only small, contained steps. Write a full **handover** (§4). |
| 85–90% | Start no substantial new work. Hand over to the other assistant or a fresh session, **if the user authorises it**. |
| 90%+ | Make no new changes. Preserve the state (do not commit unless approved) and report what remains. |

If a session is interrupted, the next session treats every unverified change as **unfinished** until it has been checked (§5).

## 3. Checkpoint (short; written in the conversation)

```
CHECKPOINT <date/time> — <task>
Branch / HEAD: <branch> @ <short sha>   Working tree: clean | staged: <files> | unstaged: <files> | untracked: <files>
Done: <bullets>
Tests run by me: <command → result>      Reported by others (not re-run): <…>
Open issues: <…>
Next action: <one concrete step>
```

## 4. Handover (complete; must stand alone)

The receiver has **no access** to the sender's conversation. Write the handover so it works without it, and give it to the user to pass on. Don't commit it unless the user asks. It must contain all of these:

```
HANDOVER <date/time>   From: <Claude|Codex>   To: <Claude|Codex|fresh session>
1. Task and objective: <what, why, approved scope, what is out of scope>
2. Git state: branch <…>, HEAD <full sha>, base develop @ <sha>
   Committed on branch (not on develop): <commits>
   Staged: <files>   Unstaged modified: <files>   Untracked: <files>
   Reviewed? <by whom, verdict>  Committed? <y/n>  Pushed? <y/n>  Merged? <y/n>
3. Completed: <bullets, each one verifiable>
4. Remaining: <bullets, in order>
5. Tests and results: EXECUTED by sender: <command → exact result>
                      REPORTED (not re-run by sender): <source → claim>
6. Known defects / unresolved findings / blockers: <…>
   (Passing known-defect tests prove the bugs still exist; they are not fixes.)
7. Decisions needing user approval: <…>
8. Next recommended action: <one exact command or step>
```

## 5. Receiving a handover: verify, don't trust

Before acting, the receiver checks the handover against the repository:

1. Run these and compare the output with handover item 2:
   ```
   git fetch
   git status --short --untracked-files=all
   git branch --show-current
   git log --oneline develop..HEAD
   git rev-parse HEAD develop origin/develop
   ```
2. Read every change. Each command shows a different layer:
   - `git diff develop...HEAD`: committed on the branch
   - `git diff --cached`: staged
   - `git diff`: unstaged
   - every untracked file

   Check that "completed" items are really present.
3. Re-run the relevant checks yourself (`npm test`, `npm run test:defects`, `npm run build`) before claiming any result. Until then, list the sender's results as *reported*.
4. If anything differs from the handover (extra or missing files, a different HEAD, failing tests), **stop and tell the user** before continuing.

## 6. Requesting and reporting a review

- **Request.** Give the base (`develop`), the scope and the specific risks to check. When Claude implements, it uses the Codex plugin, and both review layers are required (committed, and pending; see `CLAUDE.md`). Reviews are read-only. The stop-time review gate stays **off** unless the user enables it.
- **Report.** Give a verdict (for example ACCEPT, ACCEPT WITH CHANGES or REJECT). List the findings by severity with file and line, each marked *verified* or *plausible*, and say which checks the reviewer actually executed.
- **The implementer's response.** For each finding, record fixed, disagreed (with the reason) or deferred (with approval). Never quietly drop a finding.

## 7. Status communication protocol

The user must always know which assistant is working and whether a review is pending. Use these exact headings at the moment they apply:

| Heading | Use it when | Must include |
|---|---|---|
| **CLAUDE WORK COMPLETE — CODEX REVIEW STARTED** | The work is finished and a Codex review has been launched. | Review scope (base, and which layers: committed, staged, unstaged, untracked); job ID if available; foreground or background. |
| **WAITING FOR CODEX** | Codex is still running. | A clear statement that **no verdict has been received yet**; the job ID and how to check it (`/codex:status <job>`, `/codex:result <job>`, or the companion script's `status`/`result`). |
| **CODEX REVIEW COMPLETED** | The actual review output has been read, and only then. | Verdict; findings with severity; the checks **Codex executed**, kept separate from checks run by Claude; required corrections. |
| **READY FOR USER APPROVAL** | The necessary review is complete and blocking findings are resolved. | Exactly what needs approval (commit, push, implementation stage, …) and the current Git state. |

Rules:
- **No early completion.** Never report an assignment as complete while a review is running.
- **No invented verdicts.** Never predict or invent a verdict.
- **No duplicate reviews.** Don't launch a second review just because a background result hasn't appeared yet. Check its status instead.
- **No promised resumption.** Promise to resume after a background job only if the integration guarantees it. Otherwise tell the user how to check the job.
- **Who verified what.** Keep work executed by Claude separate from work independently verified by Codex.
- **Thresholds.** The usage thresholds and checkpoint/handover rules (§2–§4) still apply. Status headings never replace a required handover.
