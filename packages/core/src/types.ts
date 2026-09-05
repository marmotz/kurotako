/**
 * Public type surface of `@kurotako/core`. Runtime-code free: every export here
 * is a type or an interface. The orchestrator (`run.ts`), the error hierarchy
 * (`errors.ts`) and the writer seam (`writer/`) build on these.
 *
 * Product decisions: `backlog/features/core-pipeline/technical.md`. The IR types
 * come from `@kurotako/ir`; core owns config, driver contracts, contexts,
 * artifacts, hooks, the logger and the `run()` option / result shapes.
 */
import type { IR, SourceIR } from '@kurotako/ir';
import type { PlannedFile } from './writer/types.js';

export type { PlannedFile } from './writer/types.js';

// --- logging ---------------------------------------------------------------------

/**
 * Structured logger. Core ships a no-op default (`logger.ts`); the CLI injects a
 * real one. Contexts receive a child logger tagged with the namespace /
 * generator name.
 */
export interface Logger {
  debug(msg: string, meta?: unknown): void;
  info(msg: string, meta?: unknown): void;
  warn(msg: string, meta?: unknown): void;
  error(msg: string, meta?: unknown): void;
}

// --- resolved config ------------------------------------------------------------

/**
 * The already-resolved, already-validated configuration `run()` consumes.
 * Construction, file format and driver-option validation belong to
 * `@kurotako/config`; core only declares the shape it needs.
 */
export interface ResolvedConfig {
  /**
   * Absolute path of the directory holding the config file. Anchor for relative
   * output paths and for `ParseContext.cwd`.
   */
  rootDir: string;
  /** Key === namespace (ADR-0003). */
  sources: Record<string, SourceConfig>;
  /** Key === `Generator.name` (short name). */
  generators: Record<string, GeneratorConfig>;
  outputs: OutputConfig[];
  hooks?: Hooks;
}

export interface SourceConfig {
  parser: Parser;
  /** Opaque seam kept for `--emit` / debugging; core does not read it. */
  options?: unknown;
}

export interface GeneratorConfig {
  generator: Generator;
  /** Opaque seam kept for `--emit` / debugging; core does not read it. */
  options?: unknown;
  /** Restrict this generator to a subset of namespaces; default = all. */
  namespaces?: string[];
}

export interface OutputConfig {
  /** Default `'dir'`. */
  mode?: 'dir' | 'package';
  /** Mode A; resolved absolute by config-system. */
  dir?: string;
  /** Mode B. */
  packagesDir?: string;
  /** Mode B (required for mode B — config-system enforces). */
  scope?: string;
  /** Mode B, optional — consumed by output-modes. */
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm';
  /** Restrict this destination to a subset of `config.generators`; default = all. */
  generators?: string[];
}

// --- driver contracts ---------------------------------------------------------

export interface Parser {
  name: string;
  parse(ctx: ParseContext): Promise<SourceIR> | SourceIR;
  /**
   * Metadata for `cli --watch` — the set of paths a watcher should observe.
   * `run()` never calls it.
   */
  watchPaths?(ctx: ParseContext): string[] | Promise<string[]>;
}

export interface ParseContext {
  namespace: string;
  cwd: string;
  logger: Logger;
}

export interface Generator {
  name: string;
  /** Hard dependency: absent from the config => error. Constrains order. */
  dependsOn?: string[];
  /** Optional dependency: used if present, else ignored. Constrains order. */
  optionalDependsOn?: string[];
  generate(ctx: GenerateContext): Promise<GenOutput> | GenOutput;
}

export interface GenerateContext {
  /** Namespace-filtered deep clone of the merged IR. */
  ir: IR;
  /** Only declared deps (`dependsOn ∪ optionalDependsOn`) that actually ran. */
  dependencies: Record<string, GeneratorArtifact>;
  logger: Logger;
}

export interface GenOutput {
  files: VirtualFile[];
  artifact: GeneratorArtifact;
}

export interface VirtualFile {
  /**
   * POSIX, relative to the output root. The generator owns the
   * `<namespace>/<generatorName>/` prefix (one sub-tree per generator; core
   * synthesizes `<namespace>/index.ts`).
   */
  path: string;
  content: string;
}

// --- artifact manifest ------------------------------------------------------------

export interface GeneratorArtifact {
  /** Key === `${namespace}.${entity}`. */
  entities: Record<string, EntitySymbols>;
  /**
   * Package -> semver range the emitted code imports. Mode B: core aggregates
   * per namespace (output-modes).
   */
  peerDependencies?: Record<string, string>;
  /** Generator-defined; the consumer casts to the producer's published type. */
  extra?: unknown;
}

export interface EntitySymbols {
  /** Module specifier a sibling generator imports from. */
  module: string;
  /** Role -> exported identifier, e.g. `{ schema: "UserSchema", type: "User" }`. */
  symbols: Record<string, string>;
}

// --- hooks --------------------------------------------------------------------

export interface Hooks {
  afterEmit?(ctx: AfterEmitContext): Promise<void> | void;
}

export interface AfterEmitContext {
  /** Absolute; the directory the Writer just populated. */
  outputDir: string;
  /** Absolute paths actually written, sorted. */
  files: string[];
  logger: Logger;
}

// --- run() option / result shapes ---------------------------------------------

export interface RunOptions {
  /** Default: no-op. */
  logger?: Logger;
  /** Cooperative cancellation between steps (watch mode). */
  signal?: AbortSignal;
  /** Default `true`; `false` => run everything, skip the Writer. */
  write?: boolean;
  /**
   * Default `false`. `true` => run everything up to (not including) emission,
   * then ask each output's Writer for the files a `generate` would write
   * (absolute path + exact bytes) via `Writer.plan()`, returned as
   * `RunResult.plan`. No disk I/O, `afterEmit` does not fire. Wins over
   * `write`: `{ plan: true, write: true }` still writes nothing.
   */
  plan?: boolean;
}

export interface RunResult {
  /** Merged, validated IR (for `--emit-ir`, drift-guard). */
  ir: IR;
  /** Generator short names, in execution order. */
  order: string[];
  /** Aggregated virtual tree, sorted by path. */
  files: VirtualFile[];
  /** Generator short name -> its artifact. */
  artifacts: Record<string, GeneratorArtifact>;
  /** One entry per `config.outputs[]`, in order; `[]` when `write: false`. */
  written: { output: OutputConfig; files: string[] }[];
  /**
   * Present iff `opts.plan === true`: the files a fresh `generate` would write
   * across every `config.outputs[]` entry, absolute paths, sorted by `path`.
   * Basis of `tako check` (drift-guard).
   */
  plan?: PlannedFile[];
}
