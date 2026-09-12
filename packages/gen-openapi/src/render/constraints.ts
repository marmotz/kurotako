/**
 * `Constraints` -> JSON Schema keywords, symmetric to `parser-openapi`'s
 * `field()`. `unique` has no JSON Schema keyword for object-property
 * uniqueness (`uniqueItems` only applies to arrays) and is dropped silently.
 */
import type { Constraints, FieldType, StringFormat } from '@kurotako/ir';
import type { JsonSchemaFragment } from './schema.js';

/**
 * Inverse of `parser-openapi`'s `STRING_FORMATS`. `datetime`/`date`/`uuid`/
 * `cuid`/`cuid2`/`ulid` never reach here as a `Constraints.format` value —
 * those scalars carry their own fixed format via `renderFieldType` instead;
 * an unrecognised format (`cuid`/`cuid2`/`ulid`) emits no keyword, same
 * escape `parser-openapi` takes in the reverse direction.
 */
const FORMAT_KEYWORDS: Partial<Record<StringFormat, string>> = {
  email: 'email',
  url: 'uri',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  time: 'time',
  duration: 'duration',
};

export function applyConstraints(
  schema: JsonSchemaFragment,
  type: FieldType,
  constraints: Constraints,
): JsonSchemaFragment {
  const out: JsonSchemaFragment = { ...schema };

  if (constraints.min !== undefined) {
    out.minimum = constraints.min;
  }
  if (constraints.max !== undefined) {
    out.maximum = constraints.max;
  }
  if (constraints.minLength !== undefined) {
    out.minLength = constraints.minLength;
  }
  if (constraints.maxLength !== undefined) {
    out.maxLength = constraints.maxLength;
  }
  if (constraints.regex !== undefined) {
    out.pattern = constraints.regex;
  }
  if (
    constraints.format !== undefined &&
    type.kind === 'scalar' &&
    type.scalar === 'string'
  ) {
    const keyword = FORMAT_KEYWORDS[constraints.format];
    if (keyword !== undefined) {
      out.format = keyword;
    }
  }

  return out;
}
