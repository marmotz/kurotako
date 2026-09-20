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
import type { ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import type * as v from 'valibot';
import type {
  DependencyList,
  DependencyShape,
  DriverOptions,
  GeneratorDriverBase,
} from './types.js';

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

/**
 * Private generator dependencies are declared as descriptors (a config entry
 * without `namespaces`): `dependsOn: [{ use: zodGenerator, options: { … } }]`. The
 * function form, `dependsOn: (options) => [ … ]`, receives this generator's
 * validated options (schema Output), so the dependency's options can derive from
 * them. Each descriptor's `options` is checked against the dependency's schema.
 *
 * The two forms are separate overloads: with a single union-typed `dependsOn`,
 * TypeScript does not infer the descriptor list from the function's return.
 */
export function defineGenerator<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
  const D extends DependencyShape = readonly [],
>(
  driver: GeneratorDriverBase<S> & { dependsOn?: DependencyList<D> },
): typeof driver;
export function defineGenerator<
  const S extends v.GenericSchema<unknown, unknown> | undefined = undefined,
  const D extends DependencyShape = readonly [],
>(
  driver: GeneratorDriverBase<S> & {
    dependsOn?: (options: DriverOptions<S>) => DependencyList<D>;
  },
): typeof driver;
export function defineGenerator(driver: unknown): unknown {
  return driver;
}
