/**
 * The Writer seam. `run()` aggregates a virtual tree and hands it to the writer
 * selected by `output.mode`. Mode A (`directoryWriter`) and mode B
 * (`packageWriter`) both live in this directory.
 */
import type {
  GeneratorArtifact,
  Logger,
  OutputConfig,
  VirtualFile,
} from '../types.js';

export interface WriteInput {
  files: VirtualFile[];
  output: OutputConfig;
  /**
   * Generator short name -> artifact. Mode B reads `peerDependencies` from it;
   * mode A ignores it. Optional so a bare `directoryWriter.write({ files,
   * output })` call still type-checks.
   */
  artifacts?: Record<string, GeneratorArtifact>;
  /** Mode B logs the manual install command here when no pm is resolved. */
  logger?: Logger;
}

export interface Writer {
  write(input: WriteInput): Promise<string[]>;
}
