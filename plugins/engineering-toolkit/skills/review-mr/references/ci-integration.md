# CI / Headless Review (`--ci` mode)

> **Status: opt-in / pending CI secret.** This recipe requires an
> `ANTHROPIC_API_KEY` (or Bedrock/Vertex OIDC) CI secret that is **not yet
> provisioned** in this monorepo — the deferred secret-management work noted in
> the root `CLAUDE.md` ("requires an `ANTHROPIC_API_KEY` CI secret because the
> command makes a real API call"). Treat everything below as a ready-to-enable
> template, not a live job, until that secret lands. (G1, CC-alignment audit
> 2026-06-01.)

`/etk:review-mr` is normally local-interactive: it prompts on a stale review
gate (`y/n/r`) and on the plan confirm (`[y/n]`). Neither prompt can be answered
in a headless CI runner. The `--ci` flag makes the skill **non-interactive and
review-only** so it can run under `claude -p` and gate a pipeline.

## `--ci` semantics

When `--ci` is present (combine with `--quick` / `--standard` / `--deep` as usual):

- **Non-interactive.** Skips the `y/n/r` stale-review gate and the `[y/n]` plan
  confirm entirely. No prompt is ever emitted; there is no TTY to answer it.
- **Review-only. It NEVER posts.** `--ci` runs Phases 0–7 and writes the
  artifacts; it does **not** call any VCS write command. Posting remains the
  separate, explicitly-invoked `/etk:post-mr-comments` action (see the optional
  job below). This preserves the review→draft→post separation invariant — CI
  gating never auto-chains into posting.
- **`PIPELINE_ACK` defaults to gating.** The Phase-1 pipeline-acknowledgment
  loop is interactive; under `--ci` there is no author to answer it, so a
  failing pipeline is recorded as `gating` (the unattended default already
  documented in `phase-1-mr-info.md`) and counts toward blockers.
- **FAIL-CLOSED on SHA drift.** If `generated_from_sha` (the MR head SHA at
  review time) cannot be established, or the diff refs cannot be matched to a
  real head, the run **aborts non-zero** rather than reviewing a stale or
  ambiguous tree. A CI review of the wrong SHA is worse than no review.
- **Writes the usual artifacts.** `mr-${MR}-findings.yaml` + `.md` are written
  to `.claude/reviews/` exactly as in interactive mode (Phase 7), so a later
  manual post job can consume them.
- **Emits a machine-readable JSON summary to stdout** (last line, single line)
  for `jq` gating:

  ```json
  {"mr":123,"mode":"standard","composite_grade":"B","composite_score":82,"blocking_count":0,"findings_count":5,"gate":"pass"}
  ```

  | Field | Meaning |
  |-------|---------|
  | `mr` | MR/PR number reviewed |
  | `mode` | `quick` \| `standard` \| `deep` (the resolved mode) |
  | `composite_grade` | Letter grade from Phase 6c (`A`–`F`) |
  | `composite_score` | Composite score 0–100 from Phase 6c |
  | `blocking_count` | Count of `severity: blocking` findings in the YAML |
  | `findings_count` | Total findings written to the YAML |
  | `gate` | `pass` when `blocking_count == 0`, else `fail` |

- **Exits NONZERO when `blocking_count > 0`** so the CI job fails the pipeline
  on a merge-blocking finding. `blocking_count == 0` exits zero. (Severity
  vocabulary is unchanged: conventional `security` / `bug` / `breaking` /
  `issue [blocking]` map to `blocking`; security findings are never dropped.)

## `.gitlab-ci.yml` recipe (review-only, opt-in)

A single review job on merge-request pipelines. It runs the headless review,
captures the JSON summary, and gates on `blocking_count`. It does **not** post.

```yaml
# Requires the deferred ANTHROPIC_API_KEY / Bedrock-Vertex OIDC CI secret.
# Keep this job behind a feature flag or `when: manual` until that lands.
review-mr:
  stage: test
  image: node:20  # an image with `claude` + glab + jq available
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
  variables:
    # ANTHROPIC_API_KEY is a masked, protected CI/CD variable (see prerequisite).
    GIT_DEPTH: 0  # full history so generated_from_sha resolves (fail-closed otherwise)
  script:
    - |
      claude -p '/etk:review-mr $CI_MERGE_REQUEST_IID --standard --ci' \
        --bare \
        --allowedTools 'Bash,Read,Grep,Glob,Agent' \
        | tee review-output.txt
    # The JSON summary is the last line of stdout.
    - SUMMARY=$(grep -E '^\{"mr":' review-output.txt | tail -1)
    - echo "$SUMMARY"
    - BLOCKING=$(echo "$SUMMARY" | jq -r '.blocking_count')
    - GRADE=$(echo "$SUMMARY" | jq -r '.composite_grade')
    - echo "Review grade $GRADE, $BLOCKING blocking finding(s)."
    - |
      if [ "$BLOCKING" -gt 0 ]; then
        echo "Merge-blocking findings present — failing the pipeline."
        exit 1
      fi
  artifacts:
    when: always
    paths:
      - .claude/reviews/mr-${CI_MERGE_REQUEST_IID}-findings.yaml
      - .claude/reviews/mr-${CI_MERGE_REQUEST_IID}-findings.md
    expire_in: 1 week
```

> `--ci` already exits non-zero on `blocking_count > 0`, so the explicit
> `jq` + `exit 1` is belt-and-suspenders (and lets you surface the grade in the
> job log). Either gate is sufficient; keep both for a clear failure message.

## Optional, manually-triggered post job (NEVER auto-chained)

Posting is **never** wired to run automatically after the review job. If a team
wants CI-driven posting, it is a **separate, opt-in, `when: manual`** job that
consumes the artifact the review job produced — a human clicks "play" to post.
This keeps the never-auto-post invariant intact end-to-end.

```yaml
post-mr-comments:
  stage: test
  image: node:20
  rules:
    - if: '$CI_PIPELINE_SOURCE == "merge_request_event"'
      when: manual          # human-triggered only; never auto-runs after review-mr
      allow_failure: true
  needs:
    - job: review-mr
      artifacts: true        # consumes mr-${IID}-findings.yaml
  script:
    - |
      claude -p '/etk:post-mr-comments $CI_MERGE_REQUEST_IID --ci --severity blocking,issue' \
        --bare \
        --allowedTools 'Bash,Read'
```

`/etk:post-mr-comments --ci` performs the hardened glab inline posting (JSON via
`glab api --input` with `Content-Type: application/json`, all five position
fields + `new_line`, and "HTTP 201 is not enough" anchor round-trip
verification) and writes `anchored: true/false` back into the YAML. `--severity`
filters which findings post. None of this is reachable from `/etk:review-mr` —
the two skills stay separate by design.

## Prerequisite: CI secret (deferred)

The headless `claude -p` call makes a **real API call**, so the runner needs one
of:

- **`ANTHROPIC_API_KEY`** — a masked + protected GitLab CI/CD variable, **or**
- **Bedrock / Vertex via OIDC** — preferred for the org's existing cloud auth;
  no long-lived key in CI. See **`dtk:terraform-gitlab-ci`** for the GitLab
  OIDC → cloud trust setup (`id_tokens`, the assumed role, and the provider
  bindings).

Until that secret-management work is in scope (deferred in the root `CLAUDE.md`),
treat both jobs as **opt-in templates**: commit them behind a feature flag or
leave the review job `when: manual` so a missing secret can't break MR
pipelines for everyone.
