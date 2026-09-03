/**
 * Compile-only fixture. `tsc -b` type-checks this file; vitest ignores it (no
 * `.test.ts` suffix). It pins that `defineConfig` infers each entry's `options`
 * from `use.optionsSchema`, and rejects `options` when the driver declares none.
 */
import type { GenerateContext, GenOutput, ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import * as v from 'valibot';
import { defineConfig } from './define.js';
import type { TakoGenerator, TakoParser } from './types.js';

const withOptions = {
  name: 'with-options',
  optionsSchema: v.object({ schema: v.string() }),
  parse: (_ctx: ParseContext, options: { schema: string }): SourceIR => {
    options.schema.toUpperCase();
    return { namespace: 'pg', parser: 'with-options', entities: {}, enums: {} };
  },
} satisfies TakoParser<{ schema: string }>;

const noOptions = {
  name: 'no-options',
  generate: (_ctx: GenerateContext): GenOutput => ({
    files: [],
    artifact: { entities: {} },
  }),
} satisfies TakoGenerator;

export const ok = defineConfig({
  sources: {
    pg: { use: withOptions, options: { schema: './schema.prisma' } },
  },
  generators: [{ use: noOptions }],
});

export const badGeneratorOptions = defineConfig({
  sources: { pg: { use: withOptions, options: { schema: './s' } } },
  generators: [
    // @ts-expect-error — `no-options` declares no optionsSchema, so `options` is rejected
    { use: noOptions, options: { foo: 1 } },
  ],
});

export const badParserOptions = defineConfig({
  sources: {
    // @ts-expect-error — `options.schema` must be a string
    pg: { use: withOptions, options: { schema: 42 } },
  },
  generators: [],
});

// `options` is always optional at the type level even when the driver declares
// an `optionsSchema`; a missing-but-required value is a load-time DriverOptionsError.
export const omittedParserOptions = defineConfig({
  sources: { pg: { use: withOptions } },
  generators: [],
});
