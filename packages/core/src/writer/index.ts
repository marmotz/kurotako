/**
 * `selectWriter` — pick the writer for `output.mode`. `'dir'` or undefined =>
 * `directoryWriter`; `'package'` => `UnsupportedOutputModeError` for now
 * (output-modes replaces this branch with the real `packageWriter` in this same
 * package); anything else => `UnsupportedOutputModeError`.
 */
import { UnsupportedOutputModeError } from '../errors.js';
import type { OutputConfig } from '../types.js';
import { directoryWriter } from './directory.js';
import type { Writer } from './types.js';

export { directoryWriter } from './directory.js';
export type { Writer } from './types.js';

export function selectWriter(output: OutputConfig): Writer {
  const mode = output.mode ?? 'dir';
  if (mode === 'dir') {
    return directoryWriter;
  }
  throw new UnsupportedOutputModeError(mode);
}
