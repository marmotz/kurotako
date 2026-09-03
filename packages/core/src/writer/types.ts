/**
 * The Writer seam. `run()` aggregates a virtual tree and hands it to the writer
 * selected by `output.mode`. Mode A (`directoryWriter`) ships here; mode B
 * (`packageWriter`) is added to this same directory by output-modes.
 */
import type { OutputConfig, VirtualFile } from '../types.js';

export interface Writer {
  write(input: {
    files: VirtualFile[];
    output: OutputConfig;
  }): Promise<string[]>;
}
