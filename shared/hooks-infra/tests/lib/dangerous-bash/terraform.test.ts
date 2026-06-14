/**
 * Tests for the destructive-Terraform dangerous-bash patterns.
 *
 * Verifies the terraform category catches destroy/state-rm/workspace-delete
 * while NOT regressing on `plan`, `plan -destroy`, or `apply` (with or
 * without `-auto-approve` — deliberately out of scope per design).
 *
 * @module tests/lib/dangerous-bash/terraform
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TERRAFORM_PATTERNS,
  matchDangerousBash,
} from '../../../src/lib/dangerous-bash/index.js';

function expectTerraformMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match).not.toBeNull();
  expect(match?.pattern.category).toBe('terraform');
}

function expectNoMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match).toBeNull();
}

// =============================================================================
// TERRAFORM_PATTERNS shape
// =============================================================================

describe('TERRAFORM_PATTERNS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(TERRAFORM_PATTERNS)).toBe(true);
    expect(TERRAFORM_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should tag every entry with category="terraform"', () => {
    for (const pattern of TERRAFORM_PATTERNS) {
      expect(pattern.category).toBe('terraform');
    }
  });

  it('should give every entry a non-empty description', () => {
    for (const pattern of TERRAFORM_PATTERNS) {
      expect(typeof pattern.description).toBe('string');
      expect(pattern.description.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// positive cases
// =============================================================================

describe('terraform destroy', () => {
  it('matches `terraform destroy`', () => {
    expectTerraformMatch('terraform destroy');
  });

  it('matches `terraform destroy -auto-approve`', () => {
    expectTerraformMatch('terraform destroy -auto-approve');
  });

  it('matches `terraform destroy -target=aws_s3_bucket.foo`', () => {
    expectTerraformMatch('terraform destroy -target=aws_s3_bucket.foo');
  });

  it('matches case-insensitive: `Terraform DESTROY`', () => {
    expectTerraformMatch('Terraform DESTROY');
  });
});

describe('terraform state rm', () => {
  it('matches `terraform state rm <addr>`', () => {
    expectTerraformMatch('terraform state rm aws_instance.foo');
  });

  it('matches with extra whitespace: `terraform  state  rm`', () => {
    expectTerraformMatch('terraform  state  rm aws_instance.foo');
  });
});

describe('terraform workspace delete', () => {
  it('matches `terraform workspace delete <name>`', () => {
    expectTerraformMatch('terraform workspace delete staging');
  });

  it('matches `terraform workspace delete -force <name>`', () => {
    expectTerraformMatch('terraform workspace delete -force locked-workspace');
  });
});

// =============================================================================
// compound + sudo wrappers
// =============================================================================

describe('compound bash and sudo prefixes', () => {
  it('matches after && (compound bash)', () => {
    expectTerraformMatch('cd infra && terraform destroy');
  });

  it('matches after ; (sequential)', () => {
    expectTerraformMatch('echo cleaning up; terraform destroy -auto-approve');
  });

  it('matches sudo terraform destroy', () => {
    expectTerraformMatch('sudo terraform destroy');
  });
});

// =============================================================================
// false-positive guards (deliberate OOS items per design)
// =============================================================================

describe('false-positive guards', () => {
  it('does NOT match `terraform plan` (read-only)', () => {
    expectNoMatch('terraform plan');
  });

  it('does NOT match `terraform plan -destroy` (preview only)', () => {
    expectNoMatch('terraform plan -destroy');
  });

  it('does NOT match `terraform apply` (interactive prompt)', () => {
    expectNoMatch('terraform apply');
  });

  it('does NOT match `terraform apply -auto-approve` (deliberately OOS)', () => {
    expectNoMatch('terraform apply -auto-approve');
  });

  it('does NOT match `terraform state list` (read-only)', () => {
    expectNoMatch('terraform state list');
  });

  it('does NOT match `terraform state show <addr>` (read-only)', () => {
    expectNoMatch('terraform state show aws_instance.foo');
  });

  it('does NOT match `terraform state mv` (rename, not removal)', () => {
    expectNoMatch('terraform state mv aws_instance.foo aws_instance.bar');
  });

  it('does NOT match `terraform workspace list`', () => {
    expectNoMatch('terraform workspace list');
  });

  it('does NOT match `terraform workspace new <name>`', () => {
    expectNoMatch('terraform workspace new staging');
  });

  it('does NOT match `terraform workspace select <name>`', () => {
    expectNoMatch('terraform workspace select staging');
  });

  it('does NOT match `terraform init`', () => {
    expectNoMatch('terraform init');
  });

  it('does NOT match `terraform validate`', () => {
    expectNoMatch('terraform validate');
  });

  it('does NOT match `terraform fmt`', () => {
    expectNoMatch('terraform fmt -recursive');
  });

  it('does NOT match a bash variable named DESTROY', () => {
    expectNoMatch('DESTROY=1 ./script.sh');
  });

  it('does NOT match echo of a destructive command inside single quotes', () => {
    expectNoMatch("echo 'terraform destroy'");
  });

  it('does NOT match `tofu destroy` (different binary, word boundary)', () => {
    expectNoMatch('tofu destroy');
  });
});

// =============================================================================
// CTK_DISABLE_CATEGORY=terraform opt-out
// =============================================================================

describe('CTK_DISABLE_CATEGORY=terraform', () => {
  const original = process.env['CTK_DISABLE_CATEGORY'];

  beforeEach(() => {
    delete process.env['CTK_DISABLE_CATEGORY'];
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env['CTK_DISABLE_CATEGORY'];
    } else {
      process.env['CTK_DISABLE_CATEGORY'] = original;
    }
  });

  it('skips terraform patterns when terraform is disabled', () => {
    process.env['CTK_DISABLE_CATEGORY'] = 'terraform';
    const match = matchDangerousBash('terraform destroy');
    expect(match).toBeNull();
  });

  it('still catches filesystem patterns when terraform is disabled', () => {
    process.env['CTK_DISABLE_CATEGORY'] = 'terraform';
    const match = matchDangerousBash('rm -rf /');
    expect(match).not.toBeNull();
    expect(match?.pattern.category).toBe('filesystem');
  });

  it('catches terraform again when env var unset', () => {
    delete process.env['CTK_DISABLE_CATEGORY'];
    expectTerraformMatch('terraform destroy');
  });
});
