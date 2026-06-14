#!/usr/bin/env -S npx tsx
/**
 * Token-savings analyzer.
 *
 * Aggregates measurements.jsonl across all session directories under
 * `~/.claude/cache/token-compress/<session-id>/` and prints two reports:
 *
 *   1. Spike A validation — Read cache hit rate + total bytes saved + savings %.
 *      This is the empirical proof (or refutation) that the delta cache earns
 *      its keep, beyond "the hook fires" qualitative signal.
 *
 *   2. Spike B feasibility — Top-20 bash command prefixes by total output bytes
 *      with mean / p50 / p95. Used to decide whether to ship bash output
 *      compression and which handlers earn priority.
 *
 * Decision criteria (from Phase 3 design):
 *   ✅ Ship Spike B if top-4 prefixes ≥ 40% of total output bytes AND median ≥ 2KB
 *   ❌ Defer Spike B if top-4 < 30% (long tail dominates)
 *   🤔 Pivot if a different top-4 emerges
 *
 * Usage:
 *   npx tsx plugins/continuity-toolkit/scripts/analyze-token-savings.ts
 *   npx tsx plugins/continuity-toolkit/scripts/analyze-token-savings.ts --json   # machine-readable
 *
 * No flags by default → human-readable report. The script is read-only:
 * it never modifies the cache.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

type ReadEvent = {
  schemaVersion: 1;
  timestamp: string;
  tool: 'Read';
  outcome: 'cache_hit' | 'cache_miss';
  basename: string;
  originalBytes: number;
  returnedBytes?: number;
  savingsPct?: number;
};

type BashEvent = {
  schemaVersion: 1;
  timestamp: string;
  tool: 'Bash';
  commandPrefix: string;
  inputBytes: number;
  outputBytes: number | null;
  redacted: boolean;
  durationMs?: number;
};

type Measurement = ReadEvent | BashEvent;

function getCacheRoot(): string {
  const override = process.env['TOKEN_COMPRESS_CACHE_DIR'];
  if (override && override.length > 0) return override;
  return path.join(os.homedir(), '.claude', 'cache', 'token-compress');
}

function loadAllMeasurements(): Measurement[] {
  const root = getCacheRoot();
  if (!fs.existsSync(root)) return [];
  const sessions = fs.readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory());
  const all: Measurement[] = [];
  for (const session of sessions) {
    const file = path.join(root, session.name, 'measurements.jsonl');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        all.push(JSON.parse(trimmed) as Measurement);
      } catch {
        // Skip malformed lines silently — JSONL append is not atomic across processes.
      }
    }
  }
  return all;
}

function p(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((sorted.length * pct) / 100));
  return sorted[idx] ?? 0;
}

function analyzeReads(events: ReadEvent[]): {
  hits: number;
  misses: number;
  hitRate: number;
  totalOriginalBytesOnHits: number;
  totalReturnedBytesOnHits: number;
  bytesSaved: number;
  savingsPct: number;
} {
  const hits = events.filter(e => e.outcome === 'cache_hit');
  const misses = events.filter(e => e.outcome === 'cache_miss');
  const totalOriginalBytesOnHits = hits.reduce((s, e) => s + e.originalBytes, 0);
  const totalReturnedBytesOnHits = hits.reduce((s, e) => s + (e.returnedBytes ?? 0), 0);
  const bytesSaved = Math.max(0, totalOriginalBytesOnHits - totalReturnedBytesOnHits);
  const total = hits.length + misses.length;
  return {
    hits: hits.length,
    misses: misses.length,
    hitRate: total === 0 ? 0 : hits.length / total,
    totalOriginalBytesOnHits,
    totalReturnedBytesOnHits,
    bytesSaved,
    savingsPct:
      totalOriginalBytesOnHits === 0
        ? 0
        : Math.round((bytesSaved / totalOriginalBytesOnHits) * 100),
  };
}

type PrefixStats = {
  prefix: string;
  count: number;
  totalOutputBytes: number;
  meanOutputBytes: number;
  p50OutputBytes: number;
  p95OutputBytes: number;
  redactedCount: number;
};

function analyzeBashByPrefix(events: BashEvent[], topN = 20): {
  totalEvents: number;
  totalOutputBytes: number;
  totalRedacted: number;
  prefixes: PrefixStats[];
} {
  const totalEvents = events.length;
  const totalRedacted = events.filter(e => e.redacted).length;
  const totalOutputBytes = events.reduce((s, e) => s + (e.outputBytes ?? 0), 0);

  const byPrefix = new Map<string, BashEvent[]>();
  for (const e of events) {
    const list = byPrefix.get(e.commandPrefix) ?? [];
    list.push(e);
    byPrefix.set(e.commandPrefix, list);
  }

  const stats: PrefixStats[] = [];
  for (const [prefix, list] of byPrefix.entries()) {
    const sizes = list
      .map(e => e.outputBytes)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);
    const total = sizes.reduce((s, n) => s + n, 0);
    stats.push({
      prefix,
      count: list.length,
      totalOutputBytes: total,
      meanOutputBytes: sizes.length === 0 ? 0 : Math.round(total / sizes.length),
      p50OutputBytes: percentile(sizes, 50),
      p95OutputBytes: percentile(sizes, 95),
      redactedCount: list.filter(e => e.redacted).length,
    });
  }
  stats.sort((a, b) => b.totalOutputBytes - a.totalOutputBytes);
  return { totalEvents, totalOutputBytes, totalRedacted, prefixes: stats.slice(0, topN) };
}

function decision(top4Pct: number, medianMatched: number): string {
  if (top4Pct >= 40 && medianMatched >= 2048) return '✅ SHIP Spike B (compression worth it)';
  if (top4Pct < 30) return '❌ DEFER Spike B (long tail dominates)';
  return '🤔 PIVOT — re-evaluate top-4 against the actual data';
}

function printHumanReport(measurements: Measurement[]): void {
  const reads = measurements.filter((m): m is ReadEvent => m.tool === 'Read');
  const bash = measurements.filter((m): m is BashEvent => m.tool === 'Bash');

  console.log('━━━ Token-savings analyzer ━━━');
  console.log(`Source: ${getCacheRoot()}`);
  console.log(`Total events: ${measurements.length} (Read=${reads.length}, Bash=${bash.length})`);
  console.log('');

  // Spike A
  console.log('━━━ Spike A: Read delta-cache validation ━━━');
  if (reads.length === 0) {
    console.log('  No Read events recorded yet.');
  } else {
    const r = analyzeReads(reads);
    console.log(`  Cache hits:          ${r.hits}`);
    console.log(`  Cache misses:        ${r.misses}`);
    console.log(`  Hit rate:            ${(r.hitRate * 100).toFixed(1)}%`);
    console.log(`  Bytes original:      ${fmtBytes(r.totalOriginalBytesOnHits)}`);
    console.log(`  Bytes returned:      ${fmtBytes(r.totalReturnedBytesOnHits)} (diff content)`);
    console.log(`  Bytes saved:         ${fmtBytes(r.bytesSaved)}  (${r.savingsPct}% of original)`);
  }
  console.log('');

  // Spike B
  console.log('━━━ Spike B: Bash output feasibility ━━━');
  if (bash.length === 0) {
    console.log('  No Bash events recorded yet.');
    return;
  }
  const b = analyzeBashByPrefix(bash);
  console.log(`  Total output bytes:  ${fmtBytes(b.totalOutputBytes)}`);
  console.log(`  Redacted events:     ${b.totalRedacted} of ${b.totalEvents}`);
  console.log('');
  console.log(`  Top ${Math.min(20, b.prefixes.length)} command prefixes by total output bytes:`);
  console.log('  ┌─────────────────────────────────────────────────────────────────┐');
  console.log('  │ Prefix         Calls   Total      Mean       p50        p95     │');
  console.log('  ├─────────────────────────────────────────────────────────────────┤');
  for (const s of b.prefixes) {
    const pct = b.totalOutputBytes === 0 ? '0%' : p(s.totalOutputBytes, b.totalOutputBytes);
    const row = [
      s.prefix.padEnd(14).slice(0, 14),
      String(s.count).padStart(6),
      fmtBytes(s.totalOutputBytes).padStart(8) + ` (${pct.padStart(5)})`,
      fmtBytes(s.meanOutputBytes).padStart(9),
      fmtBytes(s.p50OutputBytes).padStart(9),
      fmtBytes(s.p95OutputBytes).padStart(8),
    ].join(' ');
    console.log(`  │ ${row.padEnd(63)} │`);
  }
  console.log('  └─────────────────────────────────────────────────────────────────┘');
  console.log('');

  // Decision
  const top4 = b.prefixes.slice(0, 4).reduce((s, p) => s + p.totalOutputBytes, 0);
  const top4Pct = b.totalOutputBytes === 0 ? 0 : (top4 / b.totalOutputBytes) * 100;
  const matched = b.prefixes
    .slice(0, 4)
    .flatMap(p => bash.filter(e => e.commandPrefix === p.prefix && e.outputBytes !== null))
    .map(e => e.outputBytes as number)
    .sort((a, b) => a - b);
  const medianMatched = percentile(matched, 50);
  console.log('━━━ Decision ━━━');
  console.log(`  Top-4 share of bash output:  ${top4Pct.toFixed(1)}%  (target ≥ 40%)`);
  console.log(`  Median size of top-4 calls:  ${fmtBytes(medianMatched)}  (target ≥ 2KB)`);
  console.log(`  Verdict: ${decision(top4Pct, medianMatched)}`);
}

function printJSON(measurements: Measurement[]): void {
  const reads = measurements.filter((m): m is ReadEvent => m.tool === 'Read');
  const bash = measurements.filter((m): m is BashEvent => m.tool === 'Bash');
  const r = reads.length === 0 ? null : analyzeReads(reads);
  const b = bash.length === 0 ? null : analyzeBashByPrefix(bash);
  console.log(JSON.stringify({ totalEvents: measurements.length, readStats: r, bashStats: b }, null, 2));
}

function main(): void {
  const wantJSON = process.argv.includes('--json');
  const measurements = loadAllMeasurements();
  if (wantJSON) printJSON(measurements);
  else printHumanReport(measurements);
}

main();
