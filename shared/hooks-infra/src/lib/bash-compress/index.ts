/**
 * Bash compression library — barrel exports.
 *
 * Currently ships the measurement layer only. Spike B's compression handlers
 * will land in this directory once measurement data justifies them.
 *
 * @module lib/bash-compress
 */

export type { BashEvent, Measurement, ReadEvent } from './measurement.js';
export {
  containsCredential,
  extractCommandPrefix,
  getMeasurementsPath,
  recordBashEvent,
  recordReadEvent,
} from './measurement.js';
