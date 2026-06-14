/**
 * Tests for provider detection (Bedrock vs Anthropic).
 *
 * @module tests/lib/provider-detection
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getProviderInfo } from '../../src/lib/input.js';

describe('getProviderInfo', () => {
  const originalBedrock = process.env['CLAUDE_CODE_USE_BEDROCK'];
  const originalModel = process.env['ANTHROPIC_MODEL'];

  beforeEach(() => {
    delete process.env['CLAUDE_CODE_USE_BEDROCK'];
    delete process.env['ANTHROPIC_MODEL'];
  });

  afterEach(() => {
    if (originalBedrock !== undefined) {
      process.env['CLAUDE_CODE_USE_BEDROCK'] = originalBedrock;
    } else {
      delete process.env['CLAUDE_CODE_USE_BEDROCK'];
    }
    if (originalModel !== undefined) {
      process.env['ANTHROPIC_MODEL'] = originalModel;
    } else {
      delete process.env['ANTHROPIC_MODEL'];
    }
  });

  it('should detect anthropic provider by default', () => {
    const info = getProviderInfo();
    expect(info.provider).toBe('anthropic');
    expect(info.model).toBeNull();
  });

  it('should detect bedrock when CLAUDE_CODE_USE_BEDROCK=1', () => {
    process.env['CLAUDE_CODE_USE_BEDROCK'] = '1';
    const info = getProviderInfo();
    expect(info.provider).toBe('bedrock');
  });

  it('should not detect bedrock for other values', () => {
    process.env['CLAUDE_CODE_USE_BEDROCK'] = '0';
    const info = getProviderInfo();
    expect(info.provider).toBe('anthropic');
  });

  it('should capture ANTHROPIC_MODEL for bedrock', () => {
    process.env['CLAUDE_CODE_USE_BEDROCK'] = '1';
    process.env['ANTHROPIC_MODEL'] = 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const info = getProviderInfo();
    expect(info.provider).toBe('bedrock');
    expect(info.model).toBe('us.anthropic.claude-3-5-sonnet-20241022-v2:0');
  });

  it('should return null model for bedrock when ANTHROPIC_MODEL not set', () => {
    process.env['CLAUDE_CODE_USE_BEDROCK'] = '1';
    const info = getProviderInfo();
    expect(info.model).toBeNull();
  });

  it('should ignore ANTHROPIC_MODEL for anthropic provider', () => {
    process.env['ANTHROPIC_MODEL'] = 'claude-opus-4-6';
    const info = getProviderInfo();
    expect(info.provider).toBe('anthropic');
    expect(info.model).toBeNull();
  });
});
