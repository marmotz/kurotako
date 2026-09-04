/**
 * `selectWriter` — pick the writer for `output.mode`. `'dir'` or undefined =>
 * `directoryWriter`; `'package'` => `packageWriter`; anything else =>
 * `UnsupportedOutputModeError`.
 */
import { UnsupportedOutputModeError } from '../errors.js';
import type { OutputConfig } from '../types.js';
import { directoryWriter } from './directory.js';
import { packageWriter } from './package.js';
import type { Writer } from './types.js';

export { directoryWriter } from './directory.js';
export { packageWriter } from './package.js';
export type { WriteInput, Writer } from './types.js';

export function selectWriter(output: OutputConfig): Writer {
  const mode = output.mode ?? 'dir';
  if (mode === 'dir') {
    return directoryWriter;
  }
  if (mode === 'package') {
    return packageWriter;
  }
  throw new UnsupportedOutputModeError(mode);
}
