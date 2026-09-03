/**
 * `prismaParser` — the `@kurotako/parser-prisma` driver.
 *
 * `@kurotako/config` validates `options` against `optionsSchema` and curries it
 * away; `@kurotako/core` then calls `parse(ctx)` once per namespace and runs
 * `validateSourceIR` on the result.
 *
 * Flow: `resolveInput` (detect.ts) → `readDmmf` (dmmf/, Prisma <= 7) →
 * `buildSourceIR` (map/). The Prisma 8 `contract.json` mode is detected but not
 * implemented in v1.
 */
import { resolve } from 'node:path';
import { defineParser } from '@kurotako/config';
import type { ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import { resolveInput } from './detect.js';
import { readDmmf } from './dmmf/load.js';
import { PrismaInputError } from './errors.js';
import { buildSourceIR } from './map/build.js';
import { PrismaParserOptions } from './options.js';

export const prismaParser = defineParser({
  name: 'prisma',
  optionsSchema: PrismaParserOptions,

  async parse(ctx: ParseContext, options): Promise<SourceIR> {
    const input = await resolveInput(ctx.cwd, options, ctx.namespace);

    if (input.mode === 8) {
      throw new PrismaInputError(
        ctx.namespace,
        input.contractPath,
        'the Prisma 8 contract.json mode is not implemented in kurotako v1',
      );
    }

    const { model, prismaVersion } = await readDmmf(input, ctx);
    return buildSourceIR(
      ctx.namespace,
      model,
      `prisma@${prismaVersion}`,
      ctx.logger,
    );
  },

  async watchPaths(ctx: ParseContext, options): Promise<string[]> {
    // The resolved schema path — a `.prisma` file, a schema folder, or the
    // deferred contract.json. A folder watch covers every `*.prisma` inside it.
    return [resolve(ctx.cwd, options.schema)];
  },
});
