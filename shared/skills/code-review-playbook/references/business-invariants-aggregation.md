# Building `business-invariants.md` as a team — the aggregation playbook

> Audience: the **owner / aggregator** turning many teammates' candidate rules into ONE clean `.claude/business-invariants.md` that `/etk:review-mr` Agent #10 consumes. Pairs with `business-invariants-intake-template.md` (what contributors fill) and `business-invariants-authoring.md` (the canonical format the output must meet).

## The two-surface model (why you don't edit the contract directly)

| Surface | File | Who writes | Allows drafts? | Read by Agent #10? |
|---|---|---|---|---|
| **Intake / staging** | `docs/business-invariants-pending.md` (or per-contributor files) | every teammate | ✅ yes — `[UNVERIFIED]`, guesses, half-formed | ❌ no |
| **The contract** | `.claude/business-invariants.md` | the aggregator, via MR | ❌ strict format only | ✅ yes |

The contract is a law book: every rule in it is authoritative, so a sloppy rule produces false-positive review findings. The intake file is a workbench where sloppiness is fine. **The aggregation pass is the gate between them.** Never copy intake content straight into the contract.

## Step 0 — pick a contribution mechanism

| Mechanism | Good when | Trade-off |
|---|---|---|
| **One shared pending file** (domain sections, contributors add under their initials) | small team, one place to look | edit collisions if many write at once |
| **Per-contributor intake files** (`docs/invariants-intake/<name>.md` from the template) | several people writing in parallel | more files to gather at aggregation |
| **Issue / MR per candidate rule** (template-driven) | you want owners, dates, discussion per rule | heaviest process |

Optional: pre-assign **domain owners** (auth, data, privacy, state machines, billing…) so two people don't both write the auth rules. Or seed the domain sections and let anyone contribute — structure without lockdown.

## The aggregation pass (run when contributions accumulate)

Work through every candidate. The output of each is exactly one of: **promote**, **ticket**, or **drop**.

1. **Collect** all candidates from the intake surface(s) into one working list.
2. **Dedup / merge.** Same rule proposed by N people → one entry. Keep the strongest evidence and the clearest wording; credit is irrelevant (git log carries it).
3. **3-question test** (from the authoring guide). A candidate that fails any question:
   - style/preference → **drop** (suggest a linter rule / CLAUDE.md instead),
   - feature-specific → **drop** (belongs in a feature doc / ADR),
   - real but unprovable-as-a-blocker → **ticket** to sharpen it.
4. **Resolve `[UNVERIFIED]` — the load-bearing step.** For each candidate that isn't fully verified, do ONE of (in order of preference):
   - **Verify now**: read the code / IaC / config, confirm the rule, and capture a real `file:line` enforcement point. Then promote.
   - **File a ticket** ("Confirm X") and **hold** the rule out of the contract until resolved.
   - **Drop** it.
   - **Never** promote an `[UNVERIFIED]` rule into the contract. (Agent #10 treats every rule as authoritative → unverified rules = false positives, and they train the agent to ignore annotations, weakening every other rule.)
5. **Harden to the canonical schema** (per `business-invariants-authoring.md`):
   - Assign the rule ID `<Section>.<Number>` (the citation handle reviewers use).
   - Confirm the enforcement tag(s), strongest → weakest. Push `[Convention]` toward `[Hook/Grep]`/`[Code]`/`[DB]` where you can.
   - **Evidence MUST be a real `path:line` in the current codebase** — not a plugin doc, not "generic principle", not a regenerated file like `AGENTS.md` as the *primary* cite (those drift). Verify the line resolves to what the rule claims.
   - Strip every draft artifact: no `[CANDIDATE]`/`[UNVERIFIED]`/`[NOTE]`, no "proposed", no contributor initials, no status banner, no "open questions" section.
6. **Resolve conflicts.** Two contributors disagree on a rule → the **verifiable / stricter** version wins; if it's a genuine domain question, escalate to the domain owner. Don't ship two contradictory rules.
7. **Promote via an MR.** Adding/modifying invariants is deliberate — open a PR/MR against the contract with rationale. The MR body lists the tickets you filed for everything that didn't make it (unverified-held, audit findings, dropped-as-style). Reviewers see a clean diff + a complete trail.

## What does NOT go in the contract (→ tickets)

- **Concrete violations you found** ("V.1 broken in 5 lambdas") → one ticket per violation, referencing the rule ID. Not a "violations found" section.
- **Open questions** ("does Cognito enforce TTL ≤ 1h?") → a research ticket. Not an inline TODO.
- **Unverified candidates** you chose to hold → a ticket; keep them in the intake/pending file, out of the contract.

## Cadence & ownership

- **Aggregator**: one named owner (or domain owners) runs the pass. Contributors don't edit the contract directly.
- **Cadence**: run when the intake file hits a threshold (e.g. ~10 new candidates) or on a fixed interval — whatever keeps the contract moving without churn. Each pass is one MR.
- **Incremental by design**: the contract grows over time. A first pass that promotes 5–8 solid rules across 2+ domains already clears the Agent #10 minimum and starts delivering review value; the rest accrues.

## Quick reference

- Contributor-facing template: `business-invariants-intake-template.md`
- Canonical format + 3-question test + per-rule schema + anti-patterns: `business-invariants-authoring.md`
- How the contract is consumed at review-time and planning-time: `load-business-invariants.md`
