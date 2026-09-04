/**
 * `angularGenerator` — the `@kurotako/gen-angular` driver.
 *
 * Hard `dependsOn: ['zod']`: core rejects a config that enables `angular`
 * without `zod`, and the topological order guarantees `ctx.dependencies.zod` is
 * always present here. `generate` is synchronous and pure: same IR + same Zod
 * artifact + same options -> deep-equal `GenOutput` (drift-guard requirement).
 */
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import { buildArtifact } from './artifact.js';
import { emitBarrel } from './emit/barrel.js';
import { emitEntity } from './emit/entity.js';
import { emitRuntime } from './emit/runtime.js';
import { AngularGeneratorOptions } from './options.js';

export const angularGenerator = defineGenerator({
  name: 'angular',
  dependsOn: ['zod'],
  optionsSchema: AngularGeneratorOptions,

  generate(ctx: GenerateContext, options): GenOutput {
    const zod = ctx.dependencies.zod;
    if (zod === undefined) {
      throw new Error(
        "gen-angular: 'zod' dependency artifact is missing at runtime despite dependsOn: ['zod']",
      );
    }

    const files: VirtualFile[] = [];

    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      const prefix = `${namespace}/angular`;
      const entities = Object.values(source.entities);

      if (entities.length > 0 && options.forms.length > 0) {
        files.push({
          path: `${prefix}/zod-forms.runtime.ts`,
          content: emitRuntime(source, options),
        });
      }
      for (const entity of entities) {
        files.push({
          path: `${prefix}/${entity.name}.form.ts`,
          content: emitEntity(
            entity,
            namespace,
            source,
            options,
            zod,
            ctx.logger,
          ),
        });
      }
      files.push({
        path: `${prefix}/index.ts`,
        content: emitBarrel(source, options),
      });
    }

    return { files, artifact: buildArtifact(ctx.ir, zod, options) };
  },
});
