/**
 * Hand-authored type surface of `@kurotako/config`.
 *
 * Unlike `@kurotako/ir` (schema-first), the config types cannot be inferred from
 * Valibot: `use` holds a live parser/generator object and `hooks.afterEmit` is a
 * function. The structural Valibot schema in `schema.ts` only validates the
 * shape of an already-loaded module. See
 * `backlog/features/config-system/technical.md` §"Not schema-first".
 */
import type {
  AfterEmitContext,
  GenerateContext,
  GenOutput,
  ParseContext,
} from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import type * as v from 'valibot';

// biome-ignore-start lint/suspicious/noExplicitAny: driver generics need a bivariant bound

/**
 * A parser driver: `@kurotako/core`'s `Parser` plus an optional `optionsSchema`
 * and an `options` second argument. `load.ts` validates `options` against
 * `optionsSchema`, then curries it away so core sees a plain `Parser`.
 */
export interface TakoParser<O = void> {
  name: string;
  /** Valibot schema for this driver's `options`; absent => no options accepted. */
  optionsSchema?: v.GenericSchema<unknown, O>;
  parse(ctx: ParseContext, options: O): SourceIR | Promise<SourceIR>;
  /** Curried like `parse`; consumed by `tako generate --watch`. */
  watchPaths?(ctx: ParseContext, options: O): string[] | Promise<string[]>;
}

/**
 * A generator driver: `@kurotako/core`'s `Generator` plus an optional
 * `optionsSchema` and an `options` second argument, curried away by `load.ts`.
 */
export interface TakoGenerator<O = void> {
  name: string;
  /** Hard dependency: absent from the config => error. Constrains order. */
  dependsOn?: string[];
  /** Optional dependency: used if present, else ignored. Constrains order. */
  optionalDependsOn?: string[];
  optionsSchema?: v.GenericSchema<unknown, O>;
  generate(ctx: GenerateContext, options: O): GenOutput | Promise<GenOutput>;
}

/**
 * The `options` type an entry carries: whatever the driver's `optionsSchema`
 * infers, else `undefined` (a passed `options` is then a type error).
 */
export type OptionsOf<D> = D extends {
  optionsSchema: v.GenericSchema<unknown, infer O>;
}
  ? O
  : undefined;

/**
 * Source entry: `options` shape is driven by `D`'s `optionsSchema` (absent =>
 * `options?: undefined`, so passing one is a type error). Always optional — a
 * missing required `options` surfaces at load time as a `DriverOptionsError`.
 */
export type SourceEntry<D = TakoParser<any>> = {
  use: D;
  options?: OptionsOf<D>;
};

/** Generator entry: like `SourceEntry`, plus an optional namespace allowlist. */
export type GeneratorEntry<D = TakoGenerator<any>> = {
  use: D;
  options?: OptionsOf<D>;
  /** Restrict this generator's IR view; default = all namespaces. */
  namespaces?: string[];
};

/** Loose entry the base `TakoConfig` uses so `defineConfig`'s generic binds. */
export interface AnySourceEntry {
  use: TakoParser<any>;
  options?: unknown;
}

/** Loose entry the base `TakoConfig` uses so `defineConfig`'s generic binds. */
export interface AnyGeneratorEntry {
  use: TakoGenerator<any>;
  options?: unknown;
  namespaces?: string[];
}

// biome-ignore-end lint/suspicious/noExplicitAny: driver generics need a bivariant bound

export interface OutputOption {
  /** Mode A (default); relative paths resolved against the config file dir. */
  dir?: string;
  mode?: 'dir' | 'package';
  /** Mode B (required). */
  packagesDir?: string;
  /** Mode B (required — the `package.json` `name` is `${scope}/${namespace}`). */
  scope?: string;
  /** Mode B, optional — output-modes auto-installs. */
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm';
}

export interface TakoHooks {
  afterEmit?(ctx: AfterEmitContext): void | Promise<void>;
}

export interface TakoConfig {
  /** Key === namespace (ADR-0003). */
  sources: Record<string, AnySourceEntry>;
  /** Array; order irrelevant (core resolves the DAG). */
  generators: readonly AnyGeneratorEntry[];
  /** Default `{ dir: './generated/kurotako' }`. */
  output?: OutputOption;
  hooks?: TakoHooks;
}
