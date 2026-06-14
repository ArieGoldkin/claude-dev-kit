/**
 * Destructive-AWS-CLI bash patterns.
 *
 * Targets AWS CLI invocations whose effects are *irreversible* — bucket
 * tear-downs, RDS final-snapshot skips, KMS key scheduled deletion, secrets
 * force-deleted without recovery window, stack/cluster/instance terminations.
 *
 * Scope (intentional):
 *   - Verb + dangerous-flag pairs (e.g. `s3 rm --recursive`, not `s3 rm <single-key>`)
 *   - Verb-only patterns where the verb itself is irreversible
 *     (e.g. `kms schedule-key-deletion`, `cloudformation delete-stack`,
 *     `ec2 terminate-instances`, `eks delete-cluster`)
 *   - `s3 sync --delete` is included though not in the original blueprint —
 *     same blast radius as `s3 rm --recursive` and a known foot-gun.
 *
 * Out of scope:
 *   - `aws s3 rm s3://bucket/single-key` (single-object delete; revertible
 *     via versioning if enabled)
 *   - `aws rds delete-db-instance` *without* `--skip-final-snapshot` (creates
 *     final snapshot by default — recoverable)
 *   - `aws secretsmanager delete-secret` *without* `--force-delete-without-recovery`
 *     (default 30-day recovery window applies)
 *
 * Patterns reuse the same `(?:^|[;&|]\s*|sudo\s+)` anchor as the filesystem
 * and http categories so compound bash and sudo wrappers are caught, while
 * the AWS verb has to appear at command position (not inside a quoted arg
 * or comment).
 *
 * @module lib/dangerous-bash/aws
 */

import type { Pattern } from './types.js';

// ANCHOR is a module-level static string composed once at load time. It
// is the SAME prefix on every pattern below — the "non-literal value"
// Semgrep warns about is this static interpolation, not user input. The
// `// nosemgrep` annotations below acknowledge that.
const ANCHOR = String.raw`(?:^|[;&|]\s*|sudo\s+)`;

export const AWS_PATTERNS: Pattern[] = [
  // s3 rb --force (recursive bucket teardown)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+s3\\s+rb\\b[^\\n]*?\\s+--force\\b`, 'i'),
    category: 'aws',
    description: 'aws s3 rb --force — recursive bucket teardown is irreversible',
  },
  // s3 rm --recursive (mass object delete)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+s3\\s+rm\\b[^\\n]*?\\s+--recursive\\b`, 'i'),
    category: 'aws',
    description: 'aws s3 rm --recursive — mass object delete; recoverable only via versioning',
  },
  // s3 sync --delete (deletes destination objects not in source)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+s3\\s+sync\\b[^\\n]*?\\s+--delete\\b`, 'i'),
    category: 'aws',
    description:
      'aws s3 sync --delete — removes destination objects absent from source; same blast radius as recursive rm',
  },
  // rds delete-db-(instance|cluster) --skip-final-snapshot (no recovery)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(
      `${ANCHOR}aws\\s+rds\\s+delete-db-(?:instance|cluster)\\b[^\\n]*?\\s+--skip-final-snapshot\\b`,
      'i'
    ),
    category: 'aws',
    description:
      'aws rds delete-db-instance/cluster --skip-final-snapshot — irreversible without snapshot',
  },
  // kms schedule-key-deletion (scheduled key destruction)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+kms\\s+schedule-key-deletion\\b`, 'i'),
    category: 'aws',
    description:
      'aws kms schedule-key-deletion — encrypted data becomes permanently unreadable after pending window',
  },
  // secretsmanager delete-secret --force-delete-without-recovery
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(
      `${ANCHOR}aws\\s+secretsmanager\\s+delete-secret\\b[^\\n]*?\\s+--force-delete-without-recovery\\b`,
      'i'
    ),
    category: 'aws',
    description:
      'aws secretsmanager delete-secret --force-delete-without-recovery — bypasses 30-day recovery window',
  },
  // cloudformation delete-stack
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+cloudformation\\s+delete-stack\\b`, 'i'),
    category: 'aws',
    description:
      'aws cloudformation delete-stack — tears down all stack resources; rollback rarely possible',
  },
  // ec2 terminate-instances (vs. stop-instances which is reversible)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+ec2\\s+terminate-instances\\b`, 'i'),
    category: 'aws',
    description: 'aws ec2 terminate-instances — irreversible; instance store data lost',
  },
  // ecr delete-repository --force (deletes images)
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+ecr\\s+delete-repository\\b[^\\n]*?\\s+--force\\b`, 'i'),
    category: 'aws',
    description: 'aws ecr delete-repository --force — deletes repository and all images',
  },
  // eks delete-cluster
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}aws\\s+eks\\s+delete-cluster\\b`, 'i'),
    category: 'aws',
    description: 'aws eks delete-cluster — destroys the EKS control plane and managed nodes',
  },
];
