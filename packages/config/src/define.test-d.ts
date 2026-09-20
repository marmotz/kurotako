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
  anchor: (rootDir: string, options): string => {
    // `options` is inferred as the schema Output: `schema` is a non-optional
    // string here (defaulted), so `.toUpperCase()` type-checks.
    return rootDir + options.schema.toUpperCase();
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
  outputs: [],
});

export const badGeneratorOptions = defineConfig({
  sources: { pg: { use: withOptions, options: { schema: './s' } } },
  generators: [
    // @ts-expect-error — `no-options` declares no optionsSchema, so `options` is rejected
    { use: noOptions, options: {} },
  ],
  outputs: [],
});

export const badAllDefaultOptions = defineConfig({
  sources: { pg: { use: withOptions } },
  generators: [
    // @ts-expect-error — `bad` is not a known option key
    { use: allDefaultOptions, options: { bad: 1 } },
  ],
  outputs: [],
});

export const badParserOptions = defineConfig({
  sources: {
    // @ts-expect-error — `options.schema` must be a string
    pg: { use: withOptions, options: { schema: 42 } },
  },
  generators: [],
  outputs: [],
});

// `requiredOptions.optionsSchema` has a required `host` => `options` is required.
export const requiredOk = defineConfig({
  sources: { pg: { use: requiredOptions, options: { host: 'x' } } },
  generators: [],
  outputs: [],
});

export const missingRequiredOptions = defineConfig({
  sources: {
    // @ts-expect-error — `options` is required: `host` has no default
    pg: { use: requiredOptions },
  },
  generators: [],
  outputs: [],
});

// --- private generator dependencies ------------------------------------------

const zodLike = defineGenerator({
  name: 'zod-like',
  optionsSchema: v.strictObject({ zodVersion: v.picklist([3, 4]) }),
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

const optionalZodLike = defineGenerator({
  name: 'optional-zod-like',
  optionsSchema: v.strictObject({ zodVersion: v.optional(v.picklist([3, 4])) }),
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

// The descriptor's `options` is typed from the dependency's own schema.
export const staticDependency = defineGenerator({
  name: 'static-dependency',
  dependsOn: [
    { use: zodLike, options: { zodVersion: 4 } },
    { use: optionalZodLike },
    { use: noOptions },
  ],
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

// @ts-expect-error — `zodVersion` must be 3 | 4
export const badDependencyOptions = defineGenerator({
  name: 'bad-dependency-options',
  dependsOn: [{ use: zodLike, options: { zodVersion: 5 } }],
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

// @ts-expect-error — `options` is required: `zodVersion` has no default
export const missingRequiredDependencyOptions = defineGenerator({
  name: 'missing-dependency-options',
  dependsOn: [{ use: zodLike }],
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

export const rejectedDependencyOptions = defineGenerator({
  name: 'rejected-dependency-options',
  // @ts-expect-error — `no-options` declares no optionsSchema
  dependsOn: [{ use: noOptions, options: {} }],
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

// The function form receives the dependent's own options Output (defaults
// applied), and its returned descriptors are checked like a static array.
export const functionDependency = defineGenerator({
  name: 'function-dependency',
  optionsSchema: v.object({ zodVersion: v.optional(v.picklist([3, 4]), 4) }),
  dependsOn: (options) => {
    // `zodVersion` is a non-optional `3 | 4` here (schema Output).
    const version: 3 | 4 = options.zodVersion;
    return [{ use: zodLike, options: { zodVersion: version } }];
  },
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

export const badFunctionDependency = defineGenerator({
  name: 'bad-function-dependency',
  optionsSchema: v.object({ n: v.number() }),
  // @ts-expect-error — `zodVersion` must be 3 | 4, not a number
  dependsOn: (options) => [
    { use: zodLike, options: { zodVersion: options.n } },
  ],
  generate: (): GenOutput => ({ files: [], artifact: { entities: {} } }),
});

// A generator with dependencies is still a valid config entry.
export const dependentInConfig = defineConfig({
  sources: { pg: { use: withOptions } },
  generators: [{ use: staticDependency }, { use: functionDependency }],
  outputs: [],
});
