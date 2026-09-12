/**
 * `FieldType` -> JSON Schema fragment, symmetric to `parser-openapi`'s
 * `mapSchema` (inverted). Also carries the `Field.list` and nullability
 * wrapping, which are properties of a `Field`/`Relation`, not of a
 * `FieldType` — applied by the caller once the base fragment is built.
 */
import type { FieldType, ScalarType } from '@kurotako/ir';

export type JsonSchemaFragment = Record<string, unknown>;

export function schemaRef(name: string): string {
  return `#/components/schemas/${name}`;
}

function scalarSchema(scalar: ScalarType): JsonSchemaFragment {
  switch (scalar) {
    case 'string':
      return { type: 'string' };
    case 'boolean':
      return { type: 'boolean' };
    case 'int':
      return { type: 'integer' };
    case 'bigint':
      return { type: 'integer', format: 'int64' };
    case 'float':
      return { type: 'number' };
    case 'decimal':
      return { type: 'number' };
    case 'date':
      return { type: 'string', format: 'date' };
    case 'datetime':
      return { type: 'string', format: 'date-time' };
    case 'uuid':
      return { type: 'string', format: 'uuid' };
    case 'bytes':
      return { type: 'string', format: 'byte' };
    case 'json':
      return {};
  }
}

/** Pure recursive mapping of a `FieldType` to a JSON Schema fragment. */
export function renderFieldType(type: FieldType): JsonSchemaFragment {
  switch (type.kind) {
    case 'scalar':
      return scalarSchema(type.scalar);
    case 'enum':
      return { $ref: schemaRef(type.ref) };
    case 'unknown':
      return {};
    case 'ref':
      return { $ref: schemaRef(type.ref) };
    case 'map':
      return {
        type: 'object',
        additionalProperties:
          type.value.kind === 'unknown' ? true : renderFieldType(type.value),
      };
    case 'array':
      return { type: 'array', items: renderFieldType(type.element) };
    case 'union': {
      const schema: JsonSchemaFragment = {
        oneOf: type.variants.map((variant) => renderFieldType(variant)),
      };
      if (type.discriminator !== undefined) {
        const discriminator: JsonSchemaFragment = {
          propertyName: type.discriminator.propertyName,
        };
        if (type.discriminator.mapping !== undefined) {
          discriminator.mapping = Object.fromEntries(
            Object.entries(type.discriminator.mapping).map(([key, target]) => [
              key,
              schemaRef(target),
            ]),
          );
        }
        schema.discriminator = discriminator;
      }
      return schema;
    }
  }
}

/**
 * `Field.list` (legacy boolean, still present alongside `FieldType.kind ===
 * 'array'`) wraps the mapped schema one more time in an array — skipped when
 * `type.kind` is already `'array'`, to avoid a double array-of-array.
 */
export function wrapListed(
  schema: JsonSchemaFragment,
  type: FieldType,
): JsonSchemaFragment {
  if (type.kind === 'array') {
    return schema;
  }
  return { type: 'array', items: schema };
}

function hasRef(schema: JsonSchemaFragment): boolean {
  return typeof schema.$ref === 'string';
}

/**
 * Nullability wrapping for a mapped schema, per OpenAPI version.
 *
 * - 3.1: widen `type` to include `'null'`; a `$ref` or `oneOf` (ref / union /
 *   enum, and anything with no bare `type` keyword to widen) wraps instead in
 *   `{ oneOf: [<schema>, { type: 'null' }] }`.
 * - 3.0: add `nullable: true` as a sibling keyword; a `$ref` cannot carry a
 *   sibling per the 3.0 spec, so it wraps in `{ allOf: [<schema>], nullable:
 *   true }` instead.
 */
export function wrapNullable(
  schema: JsonSchemaFragment,
  openapiVersion: '3.0' | '3.1',
): JsonSchemaFragment {
  if (openapiVersion === '3.0') {
    if (hasRef(schema)) {
      return { allOf: [schema], nullable: true };
    }
    return { ...schema, nullable: true };
  }

  if (hasRef(schema) || schema.oneOf !== undefined) {
    return { oneOf: [schema, { type: 'null' }] };
  }
  if (typeof schema.type === 'string') {
    return { ...schema, type: [schema.type, 'null'] };
  }
  return { oneOf: [schema, { type: 'null' }] };
}
