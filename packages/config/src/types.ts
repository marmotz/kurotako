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
 * Any Valibot object schema, carrying both its Input and Output shapes. Used as
 * the probe bound for the helper-inferred `optionsSchema` type parameter.
 */
type AnyOptionsSchema = v.GenericSchema<unknown, unknown>;

/** Options the driver body receives: schema Output, or `void` when schemaless. */
export type DriverOptions<S> = S extends AnyOptionsSchema
  ? v.InferOutput<S>
  : // biome-ignore lint/suspicious/noConfusingVoidType: a schemaless driver body takes no options
    void;

/** Options the config entry accepts: schema Input, or `never` when schemaless. */
export type EntryOptions<S> = S extends AnyOptionsSchema
  ? v.InferInput<S>
  : never;

/** The schema type carried by a helper-declared driver, or `never`. */
export type SchemaOf<D> = D extends { optionsSchema?: infer S }
  ? S extends AnyOptionsSchema
    ? S
    : never
  : never;

/**
 * The `options` member of a config entry, per decisions c/d/e of
 * `driver-options-ergonomics/technical.md`:
 * - no `optionsSchema` => `{ options?: never }` (passing one is a type error);
 * - schema Input accepts `undefined` or is all-optional => `{ options?: … }`;
 * - schema Input has a required field => `{ options: … }`.
 */
export type OptionsMember<D> = [SchemaOf<D>] extends [never]
  ? { options?: never }
  : [undefined] extends [EntryOptions<SchemaOf<D>>]
    ? { options?: EntryOptions<SchemaOf<D>> }
    : Record<string, never> extends EntryOptions<SchemaOf<D>>
      ? { options?: EntryOptions<SchemaOf<D>> }
      : { options: EntryOptions<SchemaOf<D>> };

/**
 * Source entry: `options` shape and optionality are driven by `D`'s
 * `optionsSchema` (see `OptionsMember`).
 */
export type SourceEntry<D = TakoParser<any>> = { use: D } & OptionsMember<D>;

/** Generator entry: like `SourceEntry`, plus an optional namespace allowlist. */
export type GeneratorEntry<D = TakoGenerator<any>> = {
  use: D;
  /** Restrict this generator's IR view; default = all namespaces. */
  namespaces?: string[];
} & OptionsMember<D>;

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
  /** Restrict this destination to a subset of `generators`; default = all. */
  generators?: string[];
}

export interface TakoHooks {
  afterEmit?(ctx: AfterEmitContext): void | Promise<void>;
}

export interface TakoConfig {
  /** Key === namespace (ADR-0003). */
  sources: Record<string, AnySourceEntry>;
  /** Array; order irrelevant (core resolves the DAG). */
  generators: readonly AnyGeneratorEntry[];
  /** Required — no implicit single-output default. */
  outputs: readonly OutputOption[];
  hooks?: TakoHooks;
}
