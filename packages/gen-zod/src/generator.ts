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
import { jsFile } from '@kurotako/core';
import { nonRedundantTypeAliases } from '@kurotako/ir';
import { buildArtifact } from './artifact.js';
import { dialectFor } from './dialect.js';
import { emitAliases } from './emit/aliases.js';
import { emitBarrel } from './emit/barrel.js';
import { emitEntity } from './emit/entity.js';
import { emitEnums } from './emit/enums.js';
import { emitFilters } from './emit/filters.js';
import {
  emitTemporal,
  temporalHelpersUsed,
  withTemporalImport,
} from './emit/temporal.js';
import { ZodGeneratorOptions } from './options.js';

export const zodGenerator = defineGenerator({
  name: 'zod',
  optionsSchema: ZodGeneratorOptions,

  generate(ctx: GenerateContext, options): GenOutput {
    const dialect = dialectFor(options.zodVersion, options.dateType ?? 'date');
    const files: VirtualFile[] = [];

    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      const prefix = `${namespace}/${ctx.segment}`;
      const entities = Object.values(source.entities);
      const aliases = nonRedundantTypeAliases(source);
      const cyclicRefs = new Set<string>();
      for (const key of ctx.cycles) {
        const dot = key.indexOf('.');
        if (dot > 0 && key.slice(0, dot) === namespace) {
          cyclicRefs.add(key.slice(dot + 1));
        }
      }

      // Files that may refer to the `dateType: 'temporal'` helper schemas; they
      // are collected first so `temporal.ts` is only emitted when one does.
      const dated: VirtualFile[] = [];
      if (entities.length > 0) {
        dated.push({
          path: `${prefix}/filters.ts`,
          content: emitFilters(source, dialect),
        });
      }
      if (aliases.length > 0) {
        dated.push({
          path: `${prefix}/aliases.ts`,
          content: emitAliases(source, dialect, cyclicRefs),
        });
      }
      for (const entity of entities) {
        dated.push({
          path: `${prefix}/${entity.name}.schema.ts`,
          content: emitEntity(
            ctx.ir,
            source,
            entity,
            dialect,
            ctx.logger,
            cyclicRefs,
          ),
        });
      }
      const emitsTemporal =
        dialect.dateType === 'temporal' &&
        dated.some((file) => temporalHelpersUsed(file.content).length > 0);

      files.push({
        path: `${prefix}/enums.ts`,
        content: emitEnums(source, dialect),
      });
      if (emitsTemporal) {
        files.push({ path: `${prefix}/temporal.ts`, content: emitTemporal() });
      }
      files.push(
        ...dated.map((file) => ({
          path: file.path,
          content: withTemporalImport(file.content, jsFile('./temporal')),
        })),
      );
      files.push({
        path: `${prefix}/index.ts`,
        content: emitBarrel(source, emitsTemporal),
      });
    }

    return { files, artifact: buildArtifact(ctx.ir, options, ctx.segment) };
  },
});
