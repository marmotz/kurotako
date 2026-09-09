/** Assemble scalar and enum fields into TypeScript object members. */
import type { Entity, Field, SourceIR } from '@kurotako/ir';
import { jsDoc } from './jsdoc.js';
import { fieldTsType } from './scalars.js';

export interface MemberLineOptions {
  optional: boolean;
}

/** Render one field member, including documentation and list/null wrappers. */
export function memberLine(
  field: Field,
  opts: MemberLineOptions,
  source: SourceIR,
  entity: Entity,
): string {
  let type = fieldTsType(field, source, entity);
  if (field.list) {
    if (type.includes(' | ')) type = `(${type})`;
    type = `${type}[]`;
  }
  if (field.nullable) type = `${type} | null`;

  const member = `  ${field.name}${opts.optional ? '?' : ''}: ${type};`;
  const doc = jsDoc(field);
  const indentedDoc = doc
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n');
  return doc === '' ? member : `${indentedDoc}\n${member}`;
}
