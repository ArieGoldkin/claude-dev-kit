/**
 * Tests for the token-savings measurement library.
 *
 * Verifies the privacy-sensitive bits of the spike: credential redaction,
 * command-prefix extraction (which is the only piece of bash command we
 * persist), basename extraction for read events, and the JSONL append
 * writer's failure tolerance.
 *
 * @module tests/lib/bash-compress/measurement
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  containsCredential,
  extractCommandPrefix,
  getMeasurementsPath,
  recordBashEvent,
  recordReadEvent,
} from '../../../src/lib/bash-compress/measurement.js';

// =============================================================================
// extractCommandPrefix
// =============================================================================

describe('extractCommandPrefix', () => {
  it('returns the binary name for a simple command', () => {
    expect(extractCommandPrefix('git status')).toBe('git');
  });

  it('strips a leading sudo', () => {
    expect(extractCommandPrefix('sudo aws s3 ls')).toBe('aws');
  });

  it('strips multiple env-var prefixes', () => {
    expect(extractCommandPrefix('FOO=1 BAR=2 npm test')).toBe('npm');
  });

  it('strips an absolute path', () => {
    expect(extractCommandPrefix('/usr/local/bin/python3 -m pytest')).toBe('python3');
  });

  it('returns <empty> for empty input', () => {
    expect(extractCommandPrefix('')).toBe('<empty>');
  });

  it('returns <empty> for whitespace-only input', () => {
    expect(extractCommandPrefix('   \n\t')).toBe('<empty>');
  });

  it('does NOT include args in the prefix', () => {
    expect(extractCommandPrefix('curl -X DELETE https://example.com/items/123')).toBe('curl');
  });

  it('handles `sudo -E env-var=x cmd` chain', () => {
    expect(extractCommandPrefix('sudo MYENV=1 docker ps')).toBe('docker');
  });
});

// =============================================================================
// containsCredential — false-positive sensitive
// =============================================================================

describe('containsCredential', () => {
  it('matches AWS access key id', () => {
    expect(containsCredential('AKIAIOSFODNN7EXAMPLE')).toBe(true);
  });

  it('matches Bearer token', () => {
    expect(containsCredential('Authorization: Bearer abc123def456ghi789jkl')).toBe(true);
  });

  it('matches uppercase env-var assignment with long value', () => {
    expect(containsCredential('AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY')).toBe(true);
  });

  it('matches postgres connection string with embedded creds', () => {
    expect(containsCredential('postgres://admin:hunter2@db.internal:5432/prod')).toBe(true);
  });

  it('matches private key block', () => {
    expect(containsCredential('-----BEGIN RSA PRIVATE KEY-----')).toBe(true);
  });

  it('matches api_key=value', () => {
    expect(containsCredential('api_key=abcdef0123456789abcd')).toBe(true);
  });

  it('does NOT match a short env var', () => {
    expect(containsCredential('PORT=8080')).toBe(false);
  });

  it('does NOT match a benign command', () => {
    expect(containsCredential('git status')).toBe(false);
  });

  it('does NOT match a normal log line', () => {
    expect(containsCredential('2026-04-29 [INFO] Server started on port 3000')).toBe(false);
  });

  it('does NOT match a commit hash', () => {
    expect(containsCredential('commit a3a106f1614abf')).toBe(false);
  });
});

// =============================================================================
// recordBashEvent + recordReadEvent — JSONL append, redaction
// =============================================================================

describe('recordBashEvent / recordReadEvent', () => {
  const sessionId = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let tempRoot: string;
  let jsonlPath: string;

  function readMeasurements(): unknown[] {
    if (!fs.existsSync(jsonlPath)) return [];
    return fs.readFileSync(jsonlPath, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l));
  }

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'measurement-'));
    process.env['TOKEN_COMPRESS_CACHE_DIR'] = tempRoot;
    jsonlPath = path.join(tempRoot, sessionId, 'measurements.jsonl');
  });

  afterEach(() => {
    delete process.env['TOKEN_COMPRESS_CACHE_DIR'];
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  });

  it('appends a bash event with command prefix only (no full command)', () => {
    recordBashEvent(sessionId, 'git status', 'On branch main\nnothing to commit\n');
    const events = readMeasurements();
    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event['tool']).toBe('Bash');
    expect(event['commandPrefix']).toBe('git');
    expect(event['inputBytes']).toBe(10); // 'git status'.length
    expect(typeof event['outputBytes']).toBe('number');
    expect(event['redacted']).toBe(false);
    // Crucial: full command NOT persisted anywhere
    expect(JSON.stringify(event)).not.toContain('git status');
  });

  it('redacts when output contains credentials', () => {
    recordBashEvent(
      sessionId,
      'env',
      'AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\nFOO=bar\n',
    );
    const events = readMeasurements();
    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event['redacted']).toBe(true);
    expect(event['outputBytes']).toBeNull();
  });

  it('records duration_ms when provided', () => {
    recordBashEvent(sessionId, 'sleep 1', '', 1042);
    const events = readMeasurements();
    expect(events).toHaveLength(1);
    expect((events[0] as Record<string, unknown>)['durationMs']).toBe(1042);
  });

  it('appends a read event with basename only (no full path)', () => {
    recordReadEvent(sessionId, '/Users/x/projects/secret-app/src/page.tsx', 'cache_miss', 4096);
    const events = readMeasurements();
    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event['tool']).toBe('Read');
    expect(event['outcome']).toBe('cache_miss');
    expect(event['basename']).toBe('page.tsx');
    expect(event['originalBytes']).toBe(4096);
    // Crucial: full path NOT persisted
    expect(JSON.stringify(event)).not.toContain('secret-app');
    expect(JSON.stringify(event)).not.toContain('/Users/');
  });

  it('computes savingsPct on cache_hit', () => {
    recordReadEvent(sessionId, '/x/big.txt', 'cache_hit', 10000, 250);
    const events = readMeasurements();
    expect(events).toHaveLength(1);
    const event = events[0] as Record<string, unknown>;
    expect(event['returnedBytes']).toBe(250);
    expect(event['savingsPct']).toBe(98); // (10000-250)/10000 = 97.5 → 98
  });

  it('appends multiple events on the same JSONL', () => {
    recordBashEvent(sessionId, 'pytest', 'PASSED\n');
    recordBashEvent(sessionId, 'npm test', 'OK\n');
    recordReadEvent(sessionId, '/x/a.ts', 'cache_miss', 100);
    expect(readMeasurements()).toHaveLength(3);
  });

  it('silently swallows when sessionId is empty', () => {
    expect(() => recordBashEvent('', 'git status', 'x')).not.toThrow();
    expect(() => recordReadEvent('', '/x/a', 'cache_miss', 1)).not.toThrow();
  });

  it('silently swallows when sessionId is "unknown"', () => {
    expect(() => recordBashEvent('unknown', 'git status', 'x')).not.toThrow();
    expect(() => recordReadEvent('unknown', '/x/a', 'cache_miss', 1)).not.toThrow();
    // Confirm nothing was written
    const dir = path.join(tempRoot, 'unknown');
    expect(fs.existsSync(path.join(dir, 'measurements.jsonl'))).toBe(false);
  });
});

// =============================================================================
// getMeasurementsPath
// =============================================================================

describe('getMeasurementsPath', () => {
  it('returns a path inside the per-session cache directory', () => {
    const p = getMeasurementsPath('abc-123');
    expect(p).toContain('token-compress');
    expect(p).toContain('abc-123');
    expect(p.endsWith('measurements.jsonl')).toBe(true);
  });
});
