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
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { defineParser } from '@kurotako/config';
import type { ParseContext } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import { readContract } from './contract/read.js';
import { resolveInput } from './detect.js';
import { readDmmf } from './dmmf/load.js';
import { buildSourceIR } from './map/build.js';
import { PrismaParserOptions } from './options.js';

export const prismaParser = defineParser({
  name: 'prisma',
  optionsSchema: PrismaParserOptions,

  async parse(ctx: ParseContext, options): Promise<SourceIR> {
    const input = await resolveInput(ctx.cwd, options, ctx.namespace);

    if (input.mode === 8) {
      const raw = await readFile(input.contractPath, 'utf8');
      const { model, generatorVersion } = readContract(raw, ctx, options);
      return buildSourceIR(
        ctx.namespace,
        model,
        `prisma-contract@${generatorVersion}`,
        ctx.logger,
      );
    }

    if (options.namespacePrefix) {
      ctx.logger.warn(
        'prisma parser: namespacePrefix is ignored in Prisma 7 mode',
      );
    }
    const { model, prismaVersion } = await readDmmf(input, ctx, options);
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

  anchor(rootDir, options) {
    // The directory the schema lives in. `dirname` is correct for a `.prisma`
    // file and for a `contract.json`; for a schema *folder* it yields the
    // parent, which is still a valid walk-up base for `node_modules`
    // resolution. No `stat` — the hook stays cheap.
    return dirname(resolve(rootDir, options.schema));
  },
});
