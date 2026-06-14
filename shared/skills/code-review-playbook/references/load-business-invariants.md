# Loading `.claude/business-invariants.md`

> Shared loader logic used by `/etk:review-mr` Agent #10 (review-time) AND by the planning-phase consumers `/etk:brainstorming`, `/etk:develop`, `/etk:fix-bug`.
>
> Authoring guide: `references/business-invariants-authoring.md`. Schema and vocabulary are frozen there.

## Inputs

- `mode`: one of `review` | `planning`. Determines what to do when the file is missing or sparse.
- `project_root`: usually `$CLAUDE_PROJECT_DIR`.

## Step 1 — Read the file

Look for `${project_root}/.claude/business-invariants.md`.

### File exists

Parse the rules. Each rule has:

- ID — `<Section>.<Number>` (e.g., `I.1`, `V.3`)
- Rule statement (imperative paragraph)
- Enforcement tags (one or more of `[DB]`, `[Code]`, `[Hook/Grep]`, `[External]`, `[Convention]`)
- Evidence (file:line)
- Optional: `Exempt only with:` escape hatch

Return `{ status: "loaded", invariants: [...], path }`. Proceed to consumer-specific behavior.

### File missing — branch on `mode`

#### `mode: review` (Agent #10)

Emit ONE finding with:

- `Type: question`
- `Confidence: 100`
- `Blocking: no`
- Body:
  > "No `.claude/business-invariants.md` found. Business Context Review skipped. The project has not formalized its invariants — recommend drafting this file using the authoring guide at `references/business-invariants-authoring.md` so future reviews can verify business correctness beyond pure code quality."

Return `{ status: "absent", action: "stop" }`. Caller halts; do not invent invariants.

#### `mode: planning` (brainstorming / develop / fix-bug)

First check for `${project_root}/.claude/business-invariants-skipped` (the project-level skip marker):

- **If marker exists** → return `{ status: "skipped", scope: "project", reason: "marker file present" }`. Caller proceeds without invariants context. Do not re-prompt.

- **Else** check the in-session memory for a session-level skip flag:
  - **If session flag set** → return `{ status: "skipped", scope: "session" }`. Caller proceeds without invariants context.
  - **Else** prompt the user via `AskUserQuestion`:

    ```
    Question: "No .claude/business-invariants.md found in this project.
                This file lets planning-phase skills (and /etk:review-mr's
                Agent #10) check work against the project's domain rules.
                What would you like to do?"
    Options:
      1. "Skip for this session" (default, recommended)
         — proceed without invariants context this session;
           you'll be re-prompted next session
      2. "Create one now"
         — opens the etk authoring guide; offers to draft a v0.1 stub
           via /etk:auto-research
      3. "Skip and don't ask again on this project"
         — writes .claude/business-invariants-skipped marker;
           recoverable by deleting that file
    ```

  - **Branch on choice:**
    - `Skip session` → set session flag; return `{ status: "skipped", scope: "session" }`.
    - `Create now` → output the authoring guide path. Optionally invoke `/etk:auto-research` with a goal like "draft a first-pass `.claude/business-invariants.md` for this project per the etk 2.3.1 authoring guide." Loop back to Step 1 once the file exists. If the user backs out before creation completes, treat as `Skip session`.
    - `Skip project` → write `.claude/business-invariants-skipped` (empty file is fine; presence is the signal). Return `{ status: "skipped", scope: "project" }`.

### File exists but is sparse (< 5 invariants)

#### `mode: review`

Run the review normally but flag at the end: *"Invariants file is sparse (only N rules); coverage will be incomplete."*

#### `mode: planning`

Load the rules normally. No special flagging — the planner can still benefit from a small set, and the `/etk:review-mr` review will surface the sparseness signal anyway.

## Step 2 — Hand off to the consumer

The loader does not interpret invariants against a diff or a plan. That's consumer-specific:

- `mode: review` (Agent #10) — scan the diff against each rule's domain, emit findings citing IDs.
- `mode: planning` — present invariants to the user (or to the design-review step) at the consumer skill's appropriate phase. Caller decides how to weave them in (scoring dimension, gate question, hypothesis check).

## Skip-marker hygiene

The `.claude/business-invariants-skipped` file is a project-level opt-out. Conventions:

- **Empty file** — presence is the signal; no contents required.
- **Document the location** in each consuming skill so users know how to undo the skip.
- **CI / commit visibility** — a `.claude/business-invariants-skipped` file in a commit is reviewable evidence that the project has opted out.
- **Re-enabling** — `rm .claude/business-invariants-skipped` brings back the prompt on the next planning-skill invocation.

## Constraints

1. **Never invent invariants.** This loader only reads what's in the file. If a planning-time consumer wants to suggest a rule that *should* exist, that's a separate authoring concern — point the user at the authoring guide.
2. **Never bypass the user prompt** in `mode: planning`. The create-or-skip choice is the user's, not the agent's. The only way invariants get loaded silently is if the file already exists.
3. **Project-scope only.** Invariants are per-project. Never load from `~/.claude/`, never load from a parent directory, never aggregate across projects.
4. **Read-only on success path.** Loading invariants does not modify the file. The only file-writes happen on the `Skip project` branch (writing the skip marker).
