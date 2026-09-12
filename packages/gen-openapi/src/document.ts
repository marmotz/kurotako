/**
 * Assemble the full `OpenApiDocument` object for one namespace's `SourceIR`.
 *
 * `components.schemas` covers both `source.entities` and `source.typeAliases`
 * (unions, refs-only aliases, enums) — the IR's cross-reference pass already
 * guarantees the two never collide within one source (`docs/ir.md` "Closed
 * points" §3), so both can be merged into the same flat namespace safely.
 */
import type { Logger } from '@kurotako/core';
import type { EnumDef, SourceIR } from '@kurotako/ir';
import { OpenApiGenInvalidSchemaNameError } from './errors.js';
import type { OpenApiGeneratorOptions } from './options.js';
import { renderEntity, renderTypeAlias } from './render/entity.js';
import type { JsonSchemaFragment } from './render/schema.js';

/**
 * Every reachable `EnumDef` of a source (source-level + entity-local, entity
 * shadowing on a name collision), each rendered as its own
 * `components/schemas` entry (`{ type: 'string', enum: [...] }`).
 *
 * Not called out as its own bullet in the technical design's "Document
 * assembly" section, but required for `$ref` resolvability: `render/schema.ts`
 * maps `FieldType.kind === 'enum'` to a bare `$ref` (mirroring
 * `parser-openapi`'s self-referencing `typeAliases[name] = { kind: 'enum', ref:
 * name }` entry), so every enum name needs a real schema behind it — the
 * synthetic self-referencing alias is skipped in favour of this one.
 */
function collectEnums(source: SourceIR): EnumDef[] {
  const byName = new Map<string, EnumDef>();
  for (const def of Object.values(source.enums)) {
    byName.set(def.name, def);
  }
  for (const entity of Object.values(source.entities)) {
    for (const def of Object.values(entity.enums ?? {})) {
      byName.set(def.name, def);
    }
  }
  return [...byName.values()];
}

function renderEnum(def: EnumDef): JsonSchemaFragment {
  const schema: JsonSchemaFragment = {
    type: 'string',
    enum: def.values.map((value) => value.name),
  };
  if (def.doc !== undefined) {
    schema.description = def.doc;
  }
  return schema;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, never>;
  components: { schemas: Record<string, JsonSchemaFragment> };
}

/** OpenAPI restricts a `components/schemas` key to this pattern. */
const SCHEMA_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

function pinnedOpenapiVersion(version: '3.0' | '3.1'): string {
  return version === '3.0' ? '3.0.3' : '3.1.0';
}

export function buildDocument(
  source: SourceIR,
  options: OpenApiGeneratorOptions,
  namespace: string,
  logger?: Logger,
): OpenApiDocument {
  const schemas: Record<string, JsonSchemaFragment> = {};
  const enumsByName = new Map(
    collectEnums(source).map((def) => [def.name, def]),
  );
  const names = [
    ...Object.keys(source.entities),
    ...enumsByName.keys(),
    ...Object.keys(source.typeAliases ?? {}).filter(
      (name) => !enumsByName.has(name) && source.entities[name] === undefined,
    ),
  ].sort((a, b) => a.localeCompare(b));

  for (const name of names) {
    if (!SCHEMA_NAME_PATTERN.test(name)) {
      throw new OpenApiGenInvalidSchemaNameError(name);
    }
    const entity = source.entities[name];
    if (entity !== undefined) {
      schemas[name] = renderEntity(entity, {
        openapiVersion: options.openapiVersion,
        namespace,
        logger,
      });
      continue;
    }
    const enumDef = enumsByName.get(name);
    if (enumDef !== undefined) {
      schemas[name] = renderEnum(enumDef);
      continue;
    }
    const alias = source.typeAliases?.[name];
    if (alias !== undefined) {
      schemas[name] = renderTypeAlias(alias);
    }
  }

  return {
    openapi: pinnedOpenapiVersion(options.openapiVersion),
    info: {
      title: options.title ?? namespace,
      version: options.version,
    },
    paths: {},
    components: { schemas },
  };
}
