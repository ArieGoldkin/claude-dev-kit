# `gh` inline-comment recipe

Canonical patterns for posting inline-anchored review comments to GitHub PRs via `gh api`. Use this from any skill that needs to translate a finding (file, line, body) into a PR comment that lands on the right line. This is the GitHub counterpart to [`glab-inline-comments-recipe.md`](glab-inline-comments-recipe.md).

> Audience: implementers of `/etk:post-mr-comments` and any future skill that posts inline review comments. **Read this before touching `gh api .../pulls/{N}/comments`.**

---

## The shape GitHub wants

Unlike GitLab's `position` object (which carries a `base_sha`/`head_sha`/`start_sha` triple), GitHub anchors a PR review comment with a flat `{commit_id, path, line, side}`:

```bash
# Resolve owner/repo and the PR head SHA once
read -r OWNER REPO < <(gh repo view --json owner,name -q '.owner.login + " " + .name')
HEAD_SHA=$(gh pr view "$N" --json headRefOid -q .headRefOid)

cat > /tmp/post.json <<EOF
{
  "body": $(python3 -c "import json; print(json.dumps(open('/tmp/body.md').read()))"),
  "commit_id": "$HEAD_SHA",
  "path": "path/to/file",
  "line": 89,
  "side": "RIGHT"
}
EOF

gh api "repos/${OWNER}/${REPO}/pulls/${N}/comments" \
  -X POST \
  -H "Accept: application/vnd.github+json" \
  --input /tmp/post.json \
  > /tmp/result.json
```

### Field rules (non-negotiable)

- **`commit_id` MUST be the PR head SHA** (`gh pr view N --json headRefOid`). A stale or base SHA either rejects (`422`) or anchors on the wrong revision.
- **`line`** is the line number on the file's **new** side; pair it with **`side: "RIGHT"`**. Use `LEFT` only to comment on a deleted line on the base side.
- **Multi-line comments**: add `start_line` (+ optional `start_side`) and keep `line` as the end of the range.
- **`--input` (a JSON file)** is the reliable path. Build `body` with `python3 … json.dumps()` so backticks, quotes, code fences, and newlines round-trip. Don't hand-assemble JSON with `-f`/`-F`.

---

## The key difference from GitLab: failures are loud

GitLab's headline footgun is the **silent** `201 + position: null` — a dropped anchor that looks like success. **GitHub does not do this.** A `line` that is not part of the PR diff returns a hard **`422 Unprocessable Entity`** and creates no comment, so `gh api` exits nonzero.

That means:

- **In-hunk pre-flight is still mandatory** (parse `gh pr diff N` `@@` headers) — but its job is to *route* out-of-hunk findings to the top-level fallback **before** issuing a doomed `422` round-trip, not to disambiguate a silent failure.
- **A nonzero exit on an in-hunk finding is a real bug** — stop the batch, delete any partial comment, exit `STATUS: BLOCKED`.

```python
# Verify the created comment anchored where we asked
import json, sys
r = json.load(open('/tmp/result.json'))
ok = (r.get('path') == "path/to/file"
      and (r.get('line') or r.get('original_line')) == 89)
if not ok:
    sys.exit("STATUS: BLOCKED — inline anchor failed on in-hunk finding")
print(f"INLINE: {r['path']}:{r.get('line') or r.get('original_line')} id={r['id']}")
```

---

## Out-of-hunk fallback (top-level comment)

When a finding's line is outside the diff, post a **top-level PR comment** (a GitHub *issue* comment) with the location prefixed into the body so it survives without an anchor:

```bash
# Prefix "`path:line` — " so the location is visible without an anchor
{ printf '`%s:%s` — ' "path/to/file" 89; cat /tmp/body.md; } > /tmp/ooh.md
printf '{"body": %s}' "$(python3 -c "import json; print(json.dumps(open('/tmp/ooh.md').read()))")" > /tmp/post.json

gh api "repos/${OWNER}/${REPO}/issues/${N}/comments" \
  -X POST -H "Accept: application/vnd.github+json" \
  --input /tmp/post.json > /tmp/result.json
```

(A PR's top-level comments live on the *issue* endpoint; the review-comment endpoint is inline-only.)

---

## ID mapping for YAML write-back

GitHub has no separate discussion/thread object the way GitLab does — **the created comment id IS the thread root**. So both schema fields take the same value:

| YAML field | GitLab | GitHub |
|------------|--------|--------|
| `discussion_id` | `r['id']` (discussion) | `r['id']` (comment id) |
| `note_id` | `r['notes'][0]['id']` | `r['id']` (comment id) |

Delete a posted comment (e.g. on a verification halt):

```bash
# inline review comment
gh api "repos/${OWNER}/${REPO}/pulls/comments/${NOTE_ID}" -X DELETE
# top-level issue comment
gh api "repos/${OWNER}/${REPO}/issues/comments/${NOTE_ID}" -X DELETE
```

---

## Discipline (same as GitLab)

- **Sequential, not parallel.** One comment at a time, verify each, atomic per-finding YAML write-back. Clearer failure attribution and gentler on rate limits.
- **Never blast a roll-up.** Inline-anchor in-hunk findings; the only permitted top-level note is the per-finding out-of-hunk fallback above. The summary belongs in the PR description.
- **Stop on the first in-hunk failure.** Out-of-hunk → fallback + continue; a rejected in-hunk line → delete + `STATUS: BLOCKED`.
