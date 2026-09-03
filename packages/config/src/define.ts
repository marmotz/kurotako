/**
 * `defineConfig` — identity at runtime. Its only job is to bind the generics so
 * an editor infers each entry's `options` from `use.optionsSchema` and flags a
 * wrong or unexpected `options`, per entry.
 *
 * Each collection is captured by a dedicated `const` type parameter (`S`, `G`)
 * so the `{ [K in keyof …]: … }` validators are homomorphic and report a
 * mismatch on the offending entry, not the whole literal.
 */
import type {
  GeneratorEntry,
  OutputOption,
  SourceEntry,
  TakoConfig,
  TakoHooks,
} from './types.js';

export function defineConfig<
  const S extends Record<string, { use: unknown; options?: unknown }>,
  const G extends readonly {
    use: unknown;
    options?: unknown;
    namespaces?: string[];
  }[],
>(config: {
  sources: S & { [K in keyof S]: SourceEntry<S[K]['use']> };
  generators: G & { [K in keyof G]: GeneratorEntry<G[K]['use']> };
  output?: OutputOption;
  hooks?: TakoHooks;
}): TakoConfig {
  return config as TakoConfig;
}
