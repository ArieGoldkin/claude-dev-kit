---
name: scope-check
description: "Enumerate ticket acceptance criteria before code changes — fetches ticket via Jira/GitHub MCP, extracts AC bullets/sub-tasks/checkboxes, emits a checklist to restate after each commit. Use when: user mentions a Jira/GitHub ticket ID (NAPP-1234, PROJ-456, gh issue), asks 'what's the scope of NAPP-X', references 'acceptance criteria', starts /etk:fix-bug, /etk:develop, or /etk:review-mr against a ticketed task. Triggers on: ticket ID, NAPP-, PROJ-, acceptance criteria, scope of ticket, AC for, what does ticket cover, scope check"
effort: medium
paths: []
context: fork
keep-coding-instructions: true
---

# Scope Check

Enumerate a ticket's acceptance criteria into a checklist BEFORE any code is written, then re-state the checklist after each commit until every box is ticked or explicitly deferred.

## When this skill activates

This skill is **auto-loaded by description match**, not by a typed slash command. Claude loads it when:

- The user mentions a ticket ID (`NAPP-1234`, `PROJ-456`, `#123`)
- The user asks "what's the scope of X" / "what does ticket Y cover"
- The user references "acceptance criteria" or "AC"
- A parent skill (`/etk:fix-bug`, `/etk:develop`, `/etk:review-mr`) delegates to it as Phase 0

There is no `/etk:scope-check` slash command on purpose — invisible enrichment is the contract.

## Why this exists

Recurring `/insights` friction:

- **Narrower than intended** — "you only fixed one of three findings"; "shipped login events when the ticket covered login + reset + help"
- **Wider than intended** — "you refactored adjacent code without asking"

A 60-second AC enumeration up front catches both classes. The checklist becomes the contract Claude is held to, not the user's recollection of the ticket.

## Workflow

### Step 1: Detect the ticket source

Inspect the conversation and working directory:

| Signal | Source |
|---|---|
| Ticket ID matches `^[A-Z]+-\d+$` (e.g., `NAPP-3589`, `PROJ-12`) | Jira |
| Reference like `#123`, `gh issue 123`, `github.com/.../issues/123` | GitHub |
| Branch name embeds a ticket ID (e.g., `feat/NAPP-3589-login-redesign`) | Jira (derive from branch) |
| Recent MR/PR description mentions a ticket | Use that ID |

If multiple tickets are referenced, ask the user which one(s) are in scope before proceeding.

### Step 2: Fetch the ticket

**Jira (atlassian MCP)** — Call `mcp__atlassian__getJiraIssue` with the ticket key. Required field: `cloudId` (fetch via `mcp__atlassian__getAccessibleAtlassianResources` first if unknown).

**GitHub** — Use `Bash(gh issue view <id> --json title,body,labels,assignees)` or, when the ticket lives in a different repo, `gh issue view <id> --repo <owner>/<repo>`.

**No MCP / no gh** — Ask the user to paste the ticket body. Don't guess.

### Step 3: Extract acceptance criteria

Scan the ticket description for, in priority order:

1. **An "Acceptance Criteria" / "AC" heading** followed by a list — use those items verbatim.
2. **Checkbox lines** (`- [ ]` or `- [x]`) — treat each as an AC bullet.
3. **A "Definition of Done" / "Requirements" / "Tasks" heading** — same treatment as #1.
4. **Sub-tasks linked from the parent ticket** (Jira "issuelinks" with type `Sub-task`) — fetch each sub-task summary.
5. **Numbered or bulleted lists in the description** — fall back to these if nothing structured exists.
6. **Nothing structured** — paraphrase the description into ~3-5 implicit AC bullets and explicitly mark them as inferred. Do not proceed without confirming with the user.

### Step 4: Emit the checklist

Output a single block in this exact shape:

```
SCOPE CHECK for <TICKET-ID> — <Ticket title>

Source: <Jira | GitHub | user-pasted>
Acceptance criteria:
  [ ] <AC bullet 1>
  [ ] <AC bullet 2>
  [ ] <AC bullet 3>
  …

Out of scope (explicit):
  - <anything the ticket explicitly excludes, if mentioned>

Contract:
  Re-state this checklist after each commit. Do not declare DONE until
  every box is ticked or explicitly deferred with user agreement.
```

When called as Phase 0 of a parent skill, this block becomes the parent's working contract for the rest of the task.

### Step 5: Confirm before code

If any AC is ambiguous, paraphrase your interpretation and ask the user one tight question (yes/no or A-vs-B) before any `Edit` / `Write` / `Bash(git commit*)`. Save the round-trip cost compared to discovering ambiguity at MR review.

## Integration with parent skills

| Parent | When scope-check runs | What it produces |
|---|---|---|
| `/etk:fix-bug` | Before "Observation-Driven Debugging" begins | AC checklist scoped to the bug ticket — bounds the fix |
| `/etk:develop` | As part of Phase 0 (Erotetic-Lite Gating) | AC checklist scoped to the feature ticket — feeds Phase 1 design |
| `/etk:review-mr` | Before the agent fan-out | AC checklist scoped to the MR's linked ticket — Agent #N can flag MRs that don't cover all AC |

When a parent skill calls scope-check, the parent should NOT also re-prompt for the same information; trust the checklist this skill produces.

## What this skill is NOT

- **Not** a project planner — it doesn't decompose work into tasks, estimate effort, or sequence dependencies. That's `/etk:develop`'s job.
- **Not** a test generator — `/etk:cover` writes tests against the AC; scope-check just enumerates the AC.
- **Not** a substitute for talking to the PM/reporter — if AC is genuinely missing from the ticket, the answer is to ask the ticket reporter, not to invent AC.

## Reference

- Subagent Scope Restate protocol — root `CLAUDE.md` § "Subagent Scope Restate"
- Atlassian MCP tool reference — `/etk:atlassian-integration`
- Business invariants (parallel concern, but distinct) — `.claude/business-invariants.md`

## Compliance

### Iron Laws

**IRON LAW: Do not invent acceptance criteria. If the ticket has none, ask the user before proceeding.**

**IRON LAW: After each commit, re-state the checklist and tick the boxes covered by that commit. Don't drift silently.**

### Red Flags

| If You're Thinking... | Required Action |
|---|---|
| "The ticket is clear enough, I can skip this" | STOP. Enumerate anyway. 30 seconds of upfront work beats a 30-minute re-scope. |
| "I'll figure out the AC as I go" | STOP. Implicit AC = silent drift. Enumerate first. |
| "I'll skip the un-checkable AC" | STOP. Either tick it explicitly or defer it explicitly with user agreement. Silent skip = partial delivery. |
