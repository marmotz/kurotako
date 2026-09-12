/**
 * Assemble the `GeneratorArtifact` — one `EntitySymbols` per `${namespace}.${entity}`,
 * pointing at the emitted document and the entity's `#/components/schemas/<name>`
 * pointer. No `dependsOn` (this generator reads only the IR), no
 * `peerDependencies` (the emitted document has no runtime import surface), no
 * `extra` (no consumer needs OpenAPI-specific artifact data yet).
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import { iterEntities } from '@kurotako/ir';
import type { OpenApiGeneratorOptions } from './options.js';
import { schemaRef } from './render/schema.js';

export function buildArtifact(
  ir: IR,
  options: OpenApiGeneratorOptions,
): GeneratorArtifact {
  const ext = options.format === 'yaml' ? 'yaml' : 'json';
  const entities: Record<string, EntitySymbols> = {};

  for (const { namespace, entity } of iterEntities(ir)) {
    entities[`${namespace}.${entity.name}`] = {
      module: `${namespace}/openapi/openapi.${ext}`,
      symbols: { schema: schemaRef(entity.name) },
    };
  }

  return { entities };
}
