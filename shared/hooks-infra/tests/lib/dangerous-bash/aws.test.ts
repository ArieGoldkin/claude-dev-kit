/**
 * Tests for the destructive-AWS-CLI dangerous-bash patterns.
 *
 * Verifies the aws category catches irreversible AWS CLI operations (bucket
 * teardowns, RDS/cluster terminations, KMS key deletion, etc.) while not
 * regressing on benign read-only or single-resource commands.
 *
 * @module tests/lib/dangerous-bash/aws
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AWS_PATTERNS,
  matchDangerousBash,
} from '../../../src/lib/dangerous-bash/index.js';

function expectAwsMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match).not.toBeNull();
  expect(match?.pattern.category).toBe('aws');
}

function expectNoMatch(command: string): void {
  const match = matchDangerousBash(command);
  expect(match).toBeNull();
}

// =============================================================================
// AWS_PATTERNS shape
// =============================================================================

describe('AWS_PATTERNS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(AWS_PATTERNS)).toBe(true);
    expect(AWS_PATTERNS.length).toBeGreaterThan(0);
  });

  it('should tag every entry with category="aws"', () => {
    for (const pattern of AWS_PATTERNS) {
      expect(pattern.category).toBe('aws');
    }
  });

  it('should give every entry a non-empty description', () => {
    for (const pattern of AWS_PATTERNS) {
      expect(typeof pattern.description).toBe('string');
      expect(pattern.description.length).toBeGreaterThan(0);
    }
  });
});

// =============================================================================
// s3 destructive patterns
// =============================================================================

describe('aws s3 destructive ops', () => {
  it('matches `aws s3 rb s3://bucket --force`', () => {
    expectAwsMatch('aws s3 rb s3://my-bucket --force');
  });

  it('matches `aws s3 rm s3://bucket --recursive`', () => {
    expectAwsMatch('aws s3 rm s3://my-bucket/path --recursive');
  });

  it('matches `aws s3 sync ./dist s3://bucket --delete`', () => {
    expectAwsMatch('aws s3 sync ./dist s3://my-bucket --delete');
  });

  it('matches case-insensitive --FORCE', () => {
    expectAwsMatch('aws s3 rb s3://my-bucket --FORCE');
  });

  it('matches with extra flags before --recursive', () => {
    expectAwsMatch('aws s3 rm s3://my-bucket --profile dev --recursive');
  });
});

// =============================================================================
// rds destructive patterns
// =============================================================================

describe('aws rds delete-db with --skip-final-snapshot', () => {
  it('matches `aws rds delete-db-instance --skip-final-snapshot`', () => {
    expectAwsMatch(
      'aws rds delete-db-instance --db-instance-identifier prod --skip-final-snapshot',
    );
  });

  it('matches `aws rds delete-db-cluster --skip-final-snapshot`', () => {
    expectAwsMatch(
      'aws rds delete-db-cluster --db-cluster-identifier prod --skip-final-snapshot',
    );
  });
});

// =============================================================================
// kms / secretsmanager destructive patterns
// =============================================================================

describe('aws kms / secretsmanager destructive ops', () => {
  it('matches `aws kms schedule-key-deletion`', () => {
    expectAwsMatch('aws kms schedule-key-deletion --key-id abc-123');
  });

  it('matches `aws secretsmanager delete-secret --force-delete-without-recovery`', () => {
    expectAwsMatch(
      'aws secretsmanager delete-secret --secret-id prod-secret --force-delete-without-recovery',
    );
  });
});

// =============================================================================
// cloudformation / ec2 / ecr / eks destructive patterns
// =============================================================================

describe('aws stack/instance/cluster destructive ops', () => {
  it('matches `aws cloudformation delete-stack`', () => {
    expectAwsMatch('aws cloudformation delete-stack --stack-name prod-stack');
  });

  it('matches `aws ec2 terminate-instances`', () => {
    expectAwsMatch('aws ec2 terminate-instances --instance-ids i-abcdef');
  });

  it('matches `aws ecr delete-repository --force`', () => {
    expectAwsMatch('aws ecr delete-repository --repository-name prod-app --force');
  });

  it('matches `aws eks delete-cluster`', () => {
    expectAwsMatch('aws eks delete-cluster --name prod-cluster');
  });
});

// =============================================================================
// compound + sudo wrappers
// =============================================================================

describe('compound bash and sudo prefixes', () => {
  it('matches after && (compound bash)', () => {
    expectAwsMatch('git pull && aws cloudformation delete-stack --stack-name prod');
  });

  it('matches after ; (sequential)', () => {
    expectAwsMatch('echo cleaning up; aws s3 rb s3://bucket --force');
  });

  it('matches after | (pipe directly to aws)', () => {
    // The anchor requires aws to appear immediately after the pipe boundary.
    // `cmd | xargs aws ...` does NOT match (xargs is between) — by design,
    // since xargs-wrapped invocations are a different threat model.
    expectAwsMatch('true | aws ec2 terminate-instances --instance-ids i-1');
  });

  it('matches sudo aws ec2 terminate-instances', () => {
    expectAwsMatch('sudo aws ec2 terminate-instances --instance-ids i-1');
  });
});

// =============================================================================
// false-positive guards
// =============================================================================

describe('false-positive guards', () => {
  it('does NOT match `aws sso login` (existing http negative case)', () => {
    expectNoMatch('aws sso login --profile staging-dev');
  });

  it('does NOT match `aws s3 ls`', () => {
    expectNoMatch('aws s3 ls s3://my-bucket');
  });

  it('does NOT match `aws s3 cp` (single-key)', () => {
    expectNoMatch('aws s3 cp ./file.txt s3://my-bucket/file.txt');
  });

  it('does NOT match `aws s3 rm` without --recursive (single-key delete)', () => {
    expectNoMatch('aws s3 rm s3://my-bucket/file.txt');
  });

  it('does NOT match `aws s3 sync` without --delete (additive sync)', () => {
    expectNoMatch('aws s3 sync ./dist s3://my-bucket');
  });

  it('does NOT match `aws rds describe-db-instances`', () => {
    expectNoMatch('aws rds describe-db-instances');
  });

  it('does NOT match `aws rds delete-db-instance` without --skip-final-snapshot', () => {
    expectNoMatch('aws rds delete-db-instance --db-instance-identifier prod');
  });

  it('does NOT match `aws secretsmanager delete-secret` without --force-delete-without-recovery', () => {
    expectNoMatch('aws secretsmanager delete-secret --secret-id staging-secret');
  });

  it('does NOT match `aws cloudformation describe-stacks`', () => {
    expectNoMatch('aws cloudformation describe-stacks --stack-name prod');
  });

  it('does NOT match `aws ec2 stop-instances` (reversible)', () => {
    expectNoMatch('aws ec2 stop-instances --instance-ids i-1');
  });

  it('does NOT match `aws ecr describe-repositories`', () => {
    expectNoMatch('aws ecr describe-repositories');
  });

  it('does NOT match `aws ecr delete-repository` without --force', () => {
    expectNoMatch('aws ecr delete-repository --repository-name empty-repo');
  });

  it('does NOT match `aws eks describe-cluster`', () => {
    expectNoMatch('aws eks describe-cluster --name prod');
  });

  it('does NOT match a verb-shaped substring inside an unrelated --filter arg', () => {
    expectNoMatch('aws iam list-roles --query "Roles[?contains(RoleName, \'delete-foo\')]"');
  });

  it('does NOT match `awscli` (separate binary, word boundary)', () => {
    expectNoMatch('awscli help');
  });

  it('does NOT match echo of a destructive command inside single quotes', () => {
    expectNoMatch("echo 'aws s3 rb s3://bucket --force'");
  });
});

// =============================================================================
// CTK_DISABLE_CATEGORY=aws opt-out
// =============================================================================

describe('CTK_DISABLE_CATEGORY=aws', () => {
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

  it('skips aws patterns when aws is disabled', () => {
    process.env['CTK_DISABLE_CATEGORY'] = 'aws';
    const match = matchDangerousBash('aws cloudformation delete-stack --stack-name prod');
    expect(match).toBeNull();
  });

  it('still catches filesystem patterns when aws is disabled', () => {
    process.env['CTK_DISABLE_CATEGORY'] = 'aws';
    const match = matchDangerousBash('rm -rf /');
    expect(match).not.toBeNull();
    expect(match?.pattern.category).toBe('filesystem');
  });

  it('still catches http patterns when aws is disabled', () => {
    process.env['CTK_DISABLE_CATEGORY'] = 'aws';
    const match = matchDangerousBash('curl -X DELETE https://api.example.com/items/123');
    expect(match).not.toBeNull();
    expect(match?.pattern.category).toBe('http');
  });

  it('catches aws again when env var unset', () => {
    delete process.env['CTK_DISABLE_CATEGORY'];
    expectAwsMatch('aws ec2 terminate-instances --instance-ids i-1');
  });
});
