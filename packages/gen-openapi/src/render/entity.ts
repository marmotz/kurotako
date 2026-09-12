/**
 * `Entity` -> a `components/schemas/<Entity>` object: own fields (via
 * `render/schema.ts` + `render/constraints.ts`), `required`, `additionalProperties`
 * and relations rendered nested via `$ref` (the "deep" family in `gen-zod`'s
 * vocabulary — see `packages/gen-zod/src/render/relations.ts`).
 *
 * Cross-source relations degrade to omitting the relation property entirely
 * (logged at `debug`), same choice `gen-zod`'s deep family makes: v1 cannot
 * reference a schema defined in another namespace's document. Circular
 * relations need no special handling — `$ref` in JSON Schema is natively
 * self- and mutually-recursive.
 */
import type { Logger } from '@kurotako/core';
import type { Entity, Relation, TypeAlias } from '@kurotako/ir';
import { isCrossSource } from '@kurotako/ir';
import { applyConstraints } from './constraints.js';
import {
  type JsonSchemaFragment,
  renderFieldType,
  schemaRef,
  wrapListed,
  wrapNullable,
} from './schema.js';

export interface RenderEntityOptions {
  openapiVersion: '3.0' | '3.1';
  /** The namespace the entity belongs to, for cross-source relation detection. */
  namespace: string;
  logger?: Logger;
}

function renderRelation(
  rel: Relation,
  opts: RenderEntityOptions,
): JsonSchemaFragment | null {
  if (isCrossSource(opts.namespace, rel)) {
    opts.logger?.debug(
      `gen-openapi: relation '${rel.name}' targets another source ('${rel.target.namespace}.${rel.target.entity}'); omitting it from the emitted schema`,
    );
    return null;
  }

  const target = schemaRef(rel.target.entity);
  let schema: JsonSchemaFragment =
    rel.cardinality === 'many'
      ? { type: 'array', items: { $ref: target } }
      : { $ref: target };

  if (rel.cardinality === 'one' && rel.optional) {
    schema = wrapNullable(schema, opts.openapiVersion);
  }

  return schema;
}

export function renderEntity(
  entity: Entity,
  opts: RenderEntityOptions,
): JsonSchemaFragment {
  const properties: Record<string, JsonSchemaFragment> = {};
  const required: string[] = [];

  for (const field of entity.fields) {
    let schema = renderFieldType(field.type);
    schema = applyConstraints(schema, field.type, field.constraints);
    if (field.list) {
      schema = wrapListed(schema, field.type);
    }
    if (field.nullable) {
      schema = wrapNullable(schema, opts.openapiVersion);
    }
    properties[field.name] = schema;
    if (!field.optional) {
      required.push(field.name);
    }
  }

  for (const relation of entity.relations) {
    const schema = renderRelation(relation, opts);
    if (schema !== null) {
      properties[relation.name] = schema;
    }
  }

  const schema: JsonSchemaFragment = {
    type: 'object',
    properties,
  };
  if (required.length > 0) {
    schema.required = required;
  }
  if (entity.additionalProperties !== undefined) {
    schema.additionalProperties =
      entity.additionalProperties.kind === 'unknown'
        ? true
        : renderFieldType(entity.additionalProperties);
  }
  if (entity.doc !== undefined) {
    schema.description = entity.doc;
  }

  return schema;
}

export function renderTypeAlias(alias: TypeAlias): JsonSchemaFragment {
  const schema = renderFieldType(alias.type);
  if (alias.doc !== undefined) {
    return { ...schema, description: alias.doc };
  }
  return schema;
}
