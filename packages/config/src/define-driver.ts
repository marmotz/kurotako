/**
 * `defineParser` / `defineGenerator` — declaration helpers for driver packages.
 *
 * A driver declared through these helpers keeps the *literal* type of its
 * `optionsSchema` (an annotation `: TakoParser<O>` structurally erases the
 * schema's `InferInput`, so `@kurotako/config` could never recover the option
 * keys for autocomplete / unknown-key rejection at the config entry). The
 * helper also type-checks the driver body against the schema Output.
 *
 * Runtime: identity. The returned value is the passed object.
 *
 * See `backlog/features/driver-options-ergonomics/technical.md` §3.2.
 */
import type { GenerateContext, GenOutput, ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import type * as v from 'valibot';
import type { DriverOptions } from './types.js';

export function defineParser<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
>(driver: {
  name: string;
  /** Valibot schema for this driver's `options`; absent => no options accepted. */
  optionsSchema?: S;
  parse(
    ctx: ParseContext,
    options: DriverOptions<S>,
  ): SourceIR | Promise<SourceIR>;
  /** Curried like `parse`; consumed by `tako generate --watch`. */
  watchPaths?(
    ctx: ParseContext,
    options: DriverOptions<S>,
  ): string[] | Promise<string[]>;
  /**
   * Curried like `parse`; `run()` calls it before `parse()` and passes the
   * result as `ParseContext.anchorDir`. Return `undefined` to anchor on
   * `rootDir`. Must not throw for a "not found" case.
   */
  anchor?(
    rootDir: string,
    options: DriverOptions<S>,
  ): string | undefined | Promise<string | undefined>;
}): typeof driver {
  return driver;
}

export function defineGenerator<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
>(driver: {
  name: string;
  /** Hard dependency: absent from the config => error. Constrains order. */
  dependsOn?: string[];
  /** Optional dependency: used if present, else ignored. Constrains order. */
  optionalDependsOn?: string[];
  optionsSchema?: S;
  generate(
    ctx: GenerateContext,
    options: DriverOptions<S>,
  ): GenOutput | Promise<GenOutput>;
}): typeof driver {
  return driver;
}
