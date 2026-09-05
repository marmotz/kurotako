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

/**
 * One file a `write()` would emit, resolved to its absolute on-disk path with
 * the exact bytes it would serialise (banner already applied by the caller, as
 * for `write`). `plan()` computes these without any disk I/O; `write()` is
 * `plan()` plus materialisation, so the two never drift.
 */
export interface PlannedFile {
  /** Absolute. */
  path: string;
  content: string;
}

export interface Writer {
  write(input: WriteInput): Promise<string[]>;
  /**
   * Same layout as `write()`, no disk I/O: the exact set of files `write()`
   * would produce (mode B: `<pkgDir>/src/…` remap + synthesized manifest, but
   * no `dist/`, no `pm install`).
   */
  plan(input: WriteInput): Promise<PlannedFile[]>;
}
