/**
 * Compile-only fixture. `tsc -b` type-checks this file; vitest ignores it (no
 * `.test.ts` suffix). It pins that `defineConfig` infers each entry's `options`
 * from `use.optionsSchema` (schema *Input*, defaults optional), makes `options`
 * required when the schema has a required field, and rejects `options` when the
 * driver declares none.
 */
import type { GenOutput, ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import * as v from 'valibot';
import { defineConfig } from './define.js';
import { defineGenerator, defineParser } from './define-driver.js';

const withOptions = defineParser({
  name: 'with-options',
  optionsSchema: v.strictObject({
    schema: v.optional(v.string(), './s'),
    version: v.optional(v.picklist([7, 8])),
  }),
  parse: (_ctx: ParseContext, options): SourceIR => {
    options.schema.toUpperCase();
    return { namespace: 'pg', parser: 'with-options', entities: {}, enums: {} };
  },
});

const requiredOptions = defineParser({
  name: 'required-options',
  optionsSchema: v.object({ host: v.string() }),
  parse: (_ctx: ParseContext, options): SourceIR => {
    options.host.toUpperCase();
    return {
      namespace: 'pg',
      parser: 'required-options',
      entities: {},
      enums: {},
    };
  },
});

const noOptions = defineGenerator({
  name: 'no-options',
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

const allDefaultOptions = defineGenerator({
  name: 'all-default-options',
  optionsSchema: v.object({ n: v.optional(v.number(), 1) }),
  generate: (_ctx, options): GenOutput => {
    options.n.toFixed();
    return { files: [], artifact: { entities: {} } };
  },
});

// `withOptions` fields are all defaulted/optional => `options` is optional and
// may be omitted; `noOptions` accepts no `options`.
export const ok = defineConfig({
  sources: {
    pg: { use: withOptions, options: { schema: './schema.prisma' } },
    pg2: { use: withOptions },
  },
  generators: [{ use: noOptions }, { use: allDefaultOptions }],
});

export const badGeneratorOptions = defineConfig({
  sources: { pg: { use: withOptions, options: { schema: './s' } } },
  generators: [
    // @ts-expect-error — `no-options` declares no optionsSchema, so `options` is rejected
    { use: noOptions, options: {} },
  ],
});

export const badAllDefaultOptions = defineConfig({
  sources: { pg: { use: withOptions } },
  generators: [
    // @ts-expect-error — `bad` is not a known option key
    { use: allDefaultOptions, options: { bad: 1 } },
  ],
});

export const badParserOptions = defineConfig({
  sources: {
    // @ts-expect-error — `options.schema` must be a string
    pg: { use: withOptions, options: { schema: 42 } },
  },
  generators: [],
});

// `requiredOptions.optionsSchema` has a required `host` => `options` is required.
export const requiredOk = defineConfig({
  sources: { pg: { use: requiredOptions, options: { host: 'x' } } },
  generators: [],
});

export const missingRequiredOptions = defineConfig({
  sources: {
    // @ts-expect-error — `options` is required: `host` has no default
    pg: { use: requiredOptions },
  },
  generators: [],
});
