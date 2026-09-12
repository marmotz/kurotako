/**
 * `openapiGenerator` — the `@kurotako/gen-openapi` driver.
 *
 * `@kurotako/config` validates `options` against `optionsSchema` and curries it
 * away; `@kurotako/core` then calls `generate(ctx)` with a namespace-filtered IR.
 * One `VirtualFile` per namespace: a single `openapi.<ext>` document, not one
 * file per entity — a spec is normally not split, and external tooling
 * consuming it expects one document.
 */
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import { buildArtifact } from './artifact.js';
import { buildDocument } from './document.js';
import { OpenApiGeneratorOptions } from './options.js';
import { serialize } from './serialize.js';

export const openapiGenerator = defineGenerator({
  name: 'openapi',
  optionsSchema: OpenApiGeneratorOptions,

  generate(ctx: GenerateContext, options): GenOutput {
    const files: VirtualFile[] = [];
    const ext = options.format === 'yaml' ? 'yaml' : 'json';

    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      const document = buildDocument(source, options, namespace, ctx.logger);
      files.push({
        path: `${namespace}/openapi/openapi.${ext}`,
        content: serialize(document, options.format),
      });
    }

    return { files, artifact: buildArtifact(ctx.ir, options) };
  },
});
