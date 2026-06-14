# SHA-256 Fingerprint Gating

## Table of Contents
- [Overview](#overview)
- [Phase 0: Fingerprint Check](#phase-0-fingerprint-check)
- [Fingerprint Schema](#fingerprint-schema)
- [Update Logic](#update-logic)
- [Cache Invalidation Rules](#cache-invalidation-rules)
- [Gitignore Recommendation](#gitignore-recommendation)
- [Example Phase 0 Output](#example-phase-0-output)
- [Edge Cases](#edge-cases)
- [Flags](#flags)

## Overview

Fingerprint gating skips test generation for source files that have not changed since their last successful `/cover` run. On re-runs, only modified or new files proceed through Phases 1-6 while unchanged files are reported as cached. This avoids redundant work and makes incremental `/cover` usage practical on large codebases.

The mechanism is simple: hash each source file with SHA-256, store the hashes alongside test results, and compare on the next run.

## Phase 0: Fingerprint Check

Phase 0 runs **before** Phase 1 (Discover). It narrows the scope so that subsequent phases only process files that actually need testing.

### Steps

1. Check for `.cover/fingerprints.json` in the project root
2. If the file does not exist, proceed to Phase 1 with the full scope (first run)
3. If the file exists, hash all source files in the requested scope:
   ```bash
   shasum -a 256 src/auth/login.ts src/auth/session.ts src/payments/checkout.ts ...
   ```
4. Compare each hash against the stored entry for that file path
5. Partition files into **changed** (hash differs or no entry) and **unchanged** (hash matches and last result was `pass`)
6. Emit a summary line and proceed to Phase 1 with the reduced scope

Files whose `last_result` is `fail` are always re-tested, even if the source hash has not changed.

## Fingerprint Schema

Fingerprints are stored in `.cover/fingerprints.json`:

```json
{
  "version": 1,
  "entries": {
    "src/auth/login.ts": {
      "sha256": "a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890",
      "last_tested": "2026-03-27T14:30:00Z",
      "last_result": "pass",
      "test_files": ["tests/auth/login.test.ts"]
    },
    "src/auth/session.ts": {
      "sha256": "f0e1d2c3b4a596870123456789abcdef0123456789abcdef0123456789abcdef",
      "last_tested": "2026-03-27T14:30:00Z",
      "last_result": "pass",
      "test_files": ["tests/auth/session.test.ts"]
    },
    "src/payments/checkout.ts": {
      "sha256": "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      "last_tested": "2026-03-26T09:15:00Z",
      "last_result": "fail",
      "test_files": ["tests/payments/checkout.test.ts"]
    }
  }
}
```

### Field Reference

| Field | Type | Description |
|-------|------|-------------|
| `version` | `number` | Schema version. Currently `1`. |
| `entries` | `object` | Map of source file path to fingerprint data. |
| `entries[path].sha256` | `string` | SHA-256 hex digest of the source file contents. |
| `entries[path].last_tested` | `string` | ISO 8601 timestamp of the last `/cover` run that included this file. |
| `entries[path].last_result` | `"pass" \| "fail"` | Whether all generated tests for this file passed on the last run. |
| `entries[path].test_files` | `string[]` | Paths to the test files generated for this source file. |

## Update Logic

The fingerprint file is updated after Phase 6 (Report), not during test execution.

### Step-by-Step Flow

```
Read .cover/fingerprints.json (or start empty)
         │
         ▼
Hash all source files in requested scope
         │
         ▼
Compare hashes against stored entries
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Changed    Unchanged
 (new hash,  (same hash,
  no entry,   last_result
  or fail)    = pass)
    │         │
    ▼         ▼
 Proceed    Skip
 to Ph.1    (cached)
    │
    ▼
Phases 1-6 run on changed files only
    │
    ▼
After Phase 6 completes:
    │
    ├─ Passing files: update sha256 + last_tested + last_result="pass"
    │
    ├─ Failing files: keep previous sha256 (forces re-test on next run)
    │                  update last_tested + last_result="fail"
    │
    └─ Deleted files: remove entry from fingerprints.json
```

### Key Rules

- **Passing files**: Write the current hash, timestamp, and `"pass"`. Next run will skip them if unchanged.
- **Failing files**: Preserve the **previous** hash (not the current one). This ensures the file is re-tested on the next run even if the source has not changed, because the stored hash will not match the current file.
- **New files**: Create a new entry after testing completes.
- **Write atomically**: Write to `.cover/fingerprints.json.tmp` first, then rename to avoid corruption on interrupt.

## Cache Invalidation Rules

| Scenario | Behavior |
|----------|----------|
| **Source file deleted** | Remove the entry from `fingerprints.json`. |
| **Source file renamed** | New path = new entry. Old path entry is removed (file no longer exists). |
| **Test file changed but source unchanged** | Re-test. Track test file hashes by comparing `test_files` entries — if any listed test file has been modified since `last_tested`, treat the source file as changed. |
| **`--no-cache` flag** | Skip all fingerprint logic entirely. Test everything. Do not read or write `fingerprints.json`. |
| **Manual invalidation** | Delete `.cover/fingerprints.json`. Next run tests everything and recreates the file. |
| **Different scope** | Only files in the current scope are checked. Out-of-scope entries are preserved untouched. |

## Gitignore Recommendation

Fingerprint data is machine-specific and branch-specific. Add it to `.gitignore`:

```gitignore
# /cover fingerprint cache
.cover/
```

Reasons:
- Hashes reflect the local file state, which differs across branches and developers
- The file is regenerated automatically on first run
- Committing it would cause unnecessary merge conflicts

## Example Phase 0 Output

```
Phase 0: Fingerprint Check
───────────────────────────
Reading .cover/fingerprints.json... found (7 entries)
Hashing 7 source files in scope...

  src/auth/login.ts        ✓ cached (unchanged, last pass 2026-03-27)
  src/auth/session.ts      ✓ cached (unchanged, last pass 2026-03-27)
  src/auth/middleware.ts    ✓ cached (unchanged, last pass 2026-03-27)
  src/payments/checkout.ts  ✗ changed (source modified)
  src/payments/refund.ts    ✗ changed (source modified)
  src/cart/totals.ts        ✗ new file (no previous entry)
  src/cart/discount.ts      ✗ re-test (last run failed)

3/7 files unchanged (cached), testing 4 changed files

Proceeding to Phase 1 with reduced scope...
```

## Edge Cases

### First run (no fingerprint file)

No `.cover/` directory or `fingerprints.json` exists. Phase 0 creates an empty entry set, tests everything, and writes the fingerprint file after Phase 6.

### Corrupt JSON

If `fingerprints.json` cannot be parsed:

1. Log a warning: `Warning: .cover/fingerprints.json is corrupt, ignoring cache`
2. Test everything in scope
3. Overwrite the file with valid data after Phase 6

### Empty fingerprint file

The file exists but `entries` is `{}`. Equivalent to first run — test everything.

### Very large scope (1000+ files)

Hash files in batches to avoid shell argument limits and provide progress feedback:

```bash
# Batch hashing with xargs
find src/ -name '*.ts' -print0 | xargs -0 -n 100 shasum -a 256
```

Report progress during hashing:
```
Hashing source files... 250/1247
Hashing source files... 500/1247
Hashing source files... 750/1247
Hashing source files... 1000/1247
Hashing source files... 1247/1247 done
```

### Fingerprint version mismatch

If `version` does not equal `1`, log a warning and treat as a first run. This allows future schema changes without breaking existing caches.

## Flags

| Flag | Effect |
|------|--------|
| `--no-cache` | Bypass fingerprint gating entirely. Do not read or write `.cover/fingerprints.json`. All files in scope are tested regardless of previous results. |

Usage:
```
/cover --no-cache src/auth/
```

This is useful when you want to force a clean run — for example, after upgrading a test framework or changing shared test utilities that affect all tests but are not tracked as source files.
