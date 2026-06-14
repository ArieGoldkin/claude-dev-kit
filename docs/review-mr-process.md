# `/review-mr` Process Guidelines

A process guide distilled from running deep reviews on large multi-domain MRs. The goal is a review the **author can read on the MR itself** — anchored, scannable, actionable — not a wall-of-text summary buried below the diff.

---

## Core Principle: Inline > Summary

A top-level summary comment is read once, scrolled past, and forgotten. **The review's home is the diff itself.** Each finding becomes an anchored conversation on the line that caused it.

Implications:
- **Don't post one giant review note.** Most reviewers scroll past long top-level comments. Anchored comments stay in context where the work happens.
- **One finding = one inline comment.** Don't bundle 5 unrelated findings into a "review summary" thread.
- **Bundle only when a single finding genuinely spans many lines.** Example: 28 stray `console.log` statements share one root cause — post one consolidated comment with file:line list, not 28 comments. The judgment is "would the author fix these as one task or as 28 tasks?"
- **A working review doc is for you, not the author.** Keep your scratchpad as a local file. The MR is what the team reads.

---

## Process: Three Phases

### Phase 1 — Scope & risk classification (5 min)

Before reading any code, decide depth:

1. **MR size**: file count, line count, domains touched (frontend / backend / infra / DB).
2. **Risk score (0-10)**: Scope, Cross-cutting, Risk-sensitivity (PHI/auth/billing), Unknowns, Blast radius — 0-2 each. Score ≥ 7 → deep review.
3. **Pipeline status**: if it's failing for an "expected" reason, confirm with the author and explicitly exclude from gating; if not, gate.
4. **Scope leak check**: does the MR title match the diff? Is it bundling unrelated changes (different ticket, different feature)? Flag these early — the author may not notice they snuck in.

### Phase 2 — Multi-pass review with specialization

A single pass misses things every time. Run 2-3 passes, each with a different lens.

**Pass 1 — Breadth.** Fan out specialized review agents in parallel:
- Code quality + security (always)
- Frontend developer (if frontend changes)
- Backend architect (if backend changes)
- Database architect (if migrations or models)
- AI/ML engineer (if LLM/prompt code) — load relevant `atk:*` skills

**Pass 2 — Depth.** Re-review specific areas the first pass touched lightly:
- Folder architecture (does it match existing conventions? — read sibling files)
- Hidden bugs (missing assets, hardcoded fallbacks, type/column drift)
- Scope leaks (admin/* additions, unrelated pydantic edits, dist/ committed without source)

**Pass 3 — Domain specialization.** Pull in the skills that match the feature domain:
- For LLM features: `atk:prompt-caching`, `atk:function-calling`, `atk:llm-evaluation`, `atk:llm-testing`, `atk:coaching-conversation-patterns`
- For sensitive data: `etk:hipaa-compliance-checker`
- For infrastructure: `dtk:aws-cli-toolkit`, `dtk:terraform-aws-modules`

Each pass should be told what the prior passes already found, so it doesn't repeat them.

### Phase 3 — Trim and post

This is where most reviews go wrong: they post too much.

1. **Verify each "blocker" before posting.** Some findings sound critical until you `grep` and discover they're a platform-wide pattern, not a regression. (Example: "PHI stored plaintext at rest" — sounded blocking until verifying *every* model in the platform does this; it's a platform-wide topic, not this-MR-blocking.)
2. **Drop marginal findings.** A "should fix" comment on the MR adds noise; a "should fix" backlog ticket gets tracked. Inline only what's truly critical for this merge.
3. **Draft before posting.** Write all comment bodies to a local draft file. Show it to the human. Get approval. *Then* post.
4. **Post one at a time.** Sequential `glab api` calls verify each anchor lands correctly before continuing. Batching scripts have repeatedly broken in subshells (PATH issues, stale temp files); per-comment posts make every failure isolated.

---

## Comment Format

Conventional comments (from `etk:code-review-playbook`):

```
<label> [<decoration>]: <one-line subject>

<one or two sentences of context>

<concrete fix — code snippet or specific instruction>

_Reviewed with Claude Code._
```

Labels:
- `praise` — positive callout (no decoration)
- `nitpick` — minor / preference (`[non-blocking]`)
- `suggestion` — improvement, concrete (`[non-blocking]` or `[if-minor]`)
- `issue` — problem to address (`[blocking]` or `[non-blocking]`)
- `bug` — likely incorrect behavior (`[blocking]`)
- `question` — clarification needed
- `security` — auth, PHI, injection, data exposure (`[blocking]`)
- `breaking` — breaks an API contract (`[blocking]`)

Length: **2-4 lines**. If it needs more than 4 lines, the finding probably wants to be split.

Always end with `_Reviewed with Claude Code._` so the author can tell which comments came from the agent vs a human reviewer.

---

## Anchor Strategy

Where to anchor an inline comment matters. Some rules from this session:

| Finding shape | Anchor |
|--------------|--------|
| Specific bug at one line | That line |
| Pattern affecting N files | A representative line in the most central file (e.g., the import statement that uses the wrong convention) |
| Missing asset / dead reference | The line that *references* the missing thing, not where it should be |
| Architectural/file-level issue | Line 1 of the file (or the line of the export that creates the issue) |
| Lambda/Terraform module misconfigured | The module call line, not deep in the resources block |
| Sweep across many files | One file's worst line; list all sites in the body |

For broad findings (e.g., "22 PascalCase folders fork the convention"), pick *one* representative line — don't post 22 separate comments. The author reads it once and applies the fix everywhere.

---

## Verification Before Posting

**Don't trust agent reports — verify the strongest findings yourself.** Agents hallucinate or mix paths. A 30-second check before posting saves a wrong-comment retraction.

Quick checks worth running:

- **"File doesn't exist"** → `find <path> -name "<asset>"` actually returns nothing
- **"Token X is undefined"** → `grep "<token>" globals.css` actually returns nothing
- **"Cross-tenant data leak"** → read the function and its callers; confirm `member_id` is genuinely not passed
- **"Platform-wide regression"** → `grep -rli pgcrypto` across all models to see if the rest of the platform follows a different pattern

If verification contradicts the finding, drop it. Be objective. The author trusts the comments more if every one is defensible.

---

## Trimming for Objectivity

The review doc grows. Most of it doesn't belong on the MR. Before posting:

1. **Cut "should-fix" findings unless they're critical.** Move them to a backlog ticket or to the doc the author reads, not to the MR.
2. **Cut platform-wide topics.** If the rest of the codebase has the same issue, this MR isn't the place to fix it — it's a separate ADR.
3. **Cut findings that are debatable.** A reviewer who has to argue every comment loses credibility. Post only what's clearly defensible.
4. **Cut commentary that doesn't translate to action.** "Architecture is brittle" with no concrete fix is unhelpful; either suggest a refactor or remove the comment.

The bar for "post inline" should be: **the author can reasonably address this within this MR or a stacked follow-up MR.**

---

## Posting Workflow (technical)

GitLab inline comments require a `position` object with three SHAs and a file path + line number:

```bash
# 1. Get the MR's diff SHAs
glab api projects/<encoded-path>/merge_requests/<iid>/versions \
  | jq '.[0] | {base_commit_sha, start_commit_sha, head_commit_sha}'

# 2. Verify anchor exists in the local checkout
sed -n '<line>p' <path-to-file>

# 3. Build payload via jq (avoid python in subshells; PATH is unreliable)
jq -n --rawfile body /tmp/comment.md \
  '{body: $body, position: {base_sha: "...", start_sha: "...", head_sha: "...",
    position_type: "text", new_path: "<path>", new_line: <N>}}' > /tmp/payload.json

# 4. Post one at a time
glab api projects/<encoded-path>/merge_requests/<iid>/discussions \
  --method POST --header "Content-Type: application/json" \
  --input /tmp/payload.json | jq '.notes[0] | {id, file: .position.new_path, line: .position.new_line}'
```

**Tooling notes:**
- Use `jq` for payload construction. Python-based payload building broke repeatedly in `set -e` subshells where PATH didn't include the venv.
- Always pass `Content-Type: application/json`. Without it, GitLab returns HTTP 415.
- The note ID returned should be saved (in the working doc) so any later edit/delete is straightforward.
- A whole-MR (non-positional) note uses `glab mr note <iid> -m "..."` — different command.
- Avoid literal `.env` substring in comment bodies; some hooks may treat it as a protected pattern.

---

## Anti-Patterns We Learned to Avoid

- **Don't post one giant summary comment.** Mid-thread it gets buried. If you must post a top-level comment, keep it to 5 lines: TL;DR + link to the most critical inline notes.
- **Don't blast 30+ comments without showing a draft.** Inline posts are public, hard to retract gracefully, and create noise the author has to wade through.
- **Don't gate on a known-flaky pipeline.** If the user says "the failure is expected," exclude it explicitly from review.
- **Don't review an unfamiliar domain alone.** Pull in domain skills (`atk:*`, `wtk:*`) to know the right questions to ask.
- **Don't mistake a single pass for a review.** First pass finds the loud problems. Second pass finds the structural problems. Third pass finds the patterns problems. Some MRs need all three.
- **Don't bury blockers under "shoulds".** A 60-line review with 3 blockers and 50 nits hides the real signal. List blockers first; everything else can be a backlog ticket or a separate doc.
- **Don't review the entire 1000-line diff yourself.** Fan out to subagents. The main thread synthesizes; subagents read.

---

## Suggested `/review-mr` Output Structure

After running the process, what the author sees on the MR:

1. **N inline comments**, each anchored to the line that caused it. 2-4 lines per comment. Mix of `[blocking]` and `[non-blocking]`. Conventional-comments labels.
2. **Optional top-level note** — only if there's a cross-cutting message that doesn't fit an inline anchor. ≤ 5 lines. Examples: "Pipeline failure acknowledged as expected." / "Three open security/infra questions tracked separately: [list]."
3. **No giant summary comment.** The reviewer's working doc lives elsewhere.

What the reviewer keeps locally:
- A working doc with full findings list (including everything trimmed from the MR)
- Anchor IDs of every posted note (for later edits/deletes)
- Open questions for parallel tracks (security review, BAA scope, etc.)

---

## Quick Reference

**Pass 1 (broad)** → fan out 4-7 specialized agents in parallel
**Pass 2 (deep)** → re-investigate areas the first pass touched lightly + scope leaks
**Pass 3 (domain)** → AI patterns, security audit, or DB review with specialized skills

**Per finding** → verify, decide if blocker, draft, show to human, post one at a time

**Per comment** → conventional label, 2-4 lines, anchored to a specific line, ends with `_Reviewed with Claude Code._`

**Trim before posting** → drop marginal, drop platform-wide, drop debatable, drop commentary-without-action

---
Distilled from MR !1613 review session. Update as the process evolves.
