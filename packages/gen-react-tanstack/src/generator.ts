/**
 * `reactTanstackGenerator` — the `@kurotako/gen-react-tanstack` driver.
 *
 * Private dependency on `zodGenerator`: core runs a copy of it for this generator
 * alone, before it, into `<ns>/react-tanstack/zod/`, and hands its artifact over as
 * `ctx.dependencies.zod`. The user needs no `zod` entry in the config. `generate` is
 * synchronous and pure: same IR + same Zod artifact + same options -> deep-equal
 * `GenOutput`.
 */
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import { zodGenerator } from '@kurotako/gen-zod';
import type { IR } from '@kurotako/ir';
import { buildArtifact } from './artifact.js';
import { emitBarrel } from './emit/barrel.js';
import { emitEntity } from './emit/entity.js';
import { emitRuntime } from './emit/runtime.js';
import { UnknownIncludeEntityError } from './errors.js';
import { ReactTanstackGeneratorOptions } from './options.js';
import { readZodDependency, zodExtra } from './zod-artifact.js';

/**
 * The entity names to emit per namespace, in IR order. An `include` name absent
 * from every covered namespace is a typo and throws.
 */
function selectEntities(
  ir: IR,
  include: readonly string[] | undefined,
): Map<string, string[]> {
  const selected = new Map<string, string[]>();
  for (const [namespace, source] of Object.entries(ir.sources)) {
    const names = Object.values(source.entities).map((entity) => entity.name);
    selected.set(
      namespace,
      include === undefined
        ? names
        : names.filter((name) => include.includes(name)),
    );
  }
  for (const name of include ?? []) {
    const known = Object.values(ir.sources).some(
      (source) => source.entities[name] !== undefined,
    );
    if (!known) {
      throw new UnknownIncludeEntityError(name);
    }
  }
  return selected;
}

export const reactTanstackGenerator = defineGenerator({
  name: 'react-tanstack',
  dependsOn: (options) => [
    { use: zodGenerator, options: { zodVersion: options.zodVersion } },
  ],
  optionsSchema: ReactTanstackGeneratorOptions,

  generate(ctx: GenerateContext, options): GenOutput {
    const zod = readZodDependency(ctx.dependencies);
    const selected = selectEntities(ctx.ir, options.include);
    const files: VirtualFile[] = [];

    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      const prefix = `${namespace}/react-tanstack`;
      const names = selected.get(namespace) ?? [];
      const emitted = new Set(names);

      if (names.length > 0) {
        files.push({
          path: `${prefix}/form.runtime.ts`,
          content: emitRuntime(),
        });
      }
      for (const name of names) {
        const entity = source.entities[name];
        if (entity === undefined) {
          continue;
        }
        files.push({
          path: `${prefix}/${name}.form.ts`,
          content: emitEntity(
            entity,
            namespace,
            source,
            options,
            zod,
            emitted,
            ctx.cycles,
            ctx.logger,
          ),
        });
      }
      files.push({ path: `${prefix}/index.ts`, content: emitBarrel(names) });
    }

    return {
      files,
      artifact: buildArtifact(
        ctx.ir,
        selected,
        zodExtra(zod).zodVersion,
        options,
      ),
    };
  },
});
