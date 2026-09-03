/**
 * `zodGenerator` — the `@kurotako/gen-zod` driver.
 *
 * `@kurotako/config` validates `options` against `optionsSchema` and curries it
 * away; `@kurotako/core` then calls `generate(ctx)` with a namespace-filtered IR.
 * `generate` is synchronous and pure: same IR + options -> deep-equal `GenOutput`
 * (drift-guard requirement).
 */
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import { buildArtifact } from './artifact.js';
import { dialectFor } from './dialect.js';
import { emitBarrel } from './emit/barrel.js';
import { emitEntity } from './emit/entity.js';
import { emitEnums } from './emit/enums.js';
import { emitFilters } from './emit/filters.js';
import { ZodGeneratorOptions } from './options.js';

export const zodGenerator = defineGenerator({
  name: 'zod',
  optionsSchema: ZodGeneratorOptions,

  generate(ctx: GenerateContext, options): GenOutput {
    const dialect = dialectFor(options.zodVersion);
    const files: VirtualFile[] = [];

    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      const prefix = `${namespace}/zod`;
      const entities = Object.values(source.entities);

      files.push({
        path: `${prefix}/enums.ts`,
        content: emitEnums(source, dialect),
      });
      if (entities.length > 0) {
        files.push({
          path: `${prefix}/filters.ts`,
          content: emitFilters(source, dialect),
        });
      }
      for (const entity of entities) {
        files.push({
          path: `${prefix}/${entity.name}.schema.ts`,
          content: emitEntity(ctx.ir, source, entity, dialect, ctx.logger),
        });
      }
      files.push({
        path: `${prefix}/index.ts`,
        content: emitBarrel(source),
      });
    }

    return { files, artifact: buildArtifact(ctx.ir, options) };
  },
});
