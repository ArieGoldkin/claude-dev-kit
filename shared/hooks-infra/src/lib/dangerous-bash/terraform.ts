/**
 * Destructive-Terraform bash patterns.
 *
 * Targets Terraform CLI invocations that destroy infrastructure or corrupt
 * state in irreversible ways.
 *
 * Scope (intentional):
 *   - `terraform destroy` (any flags) — wipes managed resources
 *   - `terraform state rm` — removes resources from state without destroying
 *     them; subsequent applies will recreate or orphan them, often causing
 *     production drift
 *   - `terraform workspace delete` — deletes a workspace's state file
 *
 * Out of scope (deliberately):
 *   - `terraform apply -auto-approve` — too common in CI to block; users
 *     who run it interactively are already past the gate
 *   - `terraform plan -destroy` — preview only, no resource impact
 *   - `terraform init -reconfigure` / `-migrate-state` — recoverable
 *
 * Patterns reuse the same `(?:^|[;&|]\s*|sudo\s+)terraform\b` anchor as the
 * other categories so the verb has to appear at command position, not in
 * a quoted string or comment.
 *
 * @module lib/dangerous-bash/terraform
 */

import type { Pattern } from './types.js';

// ANCHOR is a module-level static string composed once at load time. See
// aws.ts for the full rationale on the `// nosemgrep` annotations.
const ANCHOR = String.raw`(?:^|[;&|]\s*|sudo\s+)`;

export const TERRAFORM_PATTERNS: Pattern[] = [
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}terraform\\s+destroy\\b`, 'i'),
    category: 'terraform',
    description: 'terraform destroy — irreversibly tears down all resources in the configuration',
  },
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}terraform\\s+state\\s+rm\\b`, 'i'),
    category: 'terraform',
    description:
      'terraform state rm — removes resources from state, causing drift or accidental recreation',
  },
  {
    // nosemgrep: javascript.lang.security.audit.non-literal-regexp
    regex: new RegExp(`${ANCHOR}terraform\\s+workspace\\s+delete\\b`, 'i'),
    category: 'terraform',
    description: 'terraform workspace delete — deletes the workspace state file',
  },
];
