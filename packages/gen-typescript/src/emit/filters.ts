/** Shared Prisma-style Where filter interfaces. */
import type { SourceIR } from '@kurotako/ir';
import { scalarTsType } from '@kurotako/ir';
import { enumTypeName } from '../names.js';
import { filterClass } from '../render/variants.js';

const EQUALITY_OPS = ['equals', 'not'] as const;
const LIST_OPS = ['in', 'notIn'] as const;
const ORDER_OPS = ['lt', 'lte', 'gt', 'gte'] as const;
const STRING_OPS = ['contains', 'startsWith', 'endsWith'] as const;
const SCALAR_FILTER_ORDER = [
  'StringFilter',
  'IntFilter',
  'FloatFilter',
  'BigIntFilter',
  'DateTimeFilter',
  'BoolFilter',
] as const;

type ScalarFilter = (typeof SCALAR_FILTER_ORDER)[number];

/** Collect the public filter interface identifiers emitted for a source. */
export function collectFilterNames(source: SourceIR): Set<string> {
  const names = new Set<string>();
  for (const entity of Object.values(source.entities)) {
    for (const field of entity.fields) {
      const filter = filterClass(field);
      if (filter !== null) names.add(filter);
    }
  }
  return names;
}

function baseType(name: ScalarFilter): string {
  switch (name) {
    case 'StringFilter':
      return scalarTsType({ kind: 'scalar', scalar: 'string' });
    case 'IntFilter':
    case 'FloatFilter':
      return scalarTsType({ kind: 'scalar', scalar: 'int' });
    case 'BigIntFilter':
      return scalarTsType({ kind: 'scalar', scalar: 'bigint' });
    case 'DateTimeFilter':
      return scalarTsType({ kind: 'scalar', scalar: 'datetime' });
    case 'BoolFilter':
      return scalarTsType({ kind: 'scalar', scalar: 'boolean' });
  }
}

function operations(name: string): readonly string[] {
  if (name === 'BoolFilter') return EQUALITY_OPS;
  if (name === 'StringFilter') {
    return [...EQUALITY_OPS, ...LIST_OPS, ...ORDER_OPS, ...STRING_OPS];
  }
  return [...EQUALITY_OPS, ...LIST_OPS, ...ORDER_OPS];
}

function emitInterface(
  name: string,
  type: string,
  ops: readonly string[],
): string {
  const members = ops.map((operation) => {
    const list = (LIST_OPS as readonly string[]).includes(operation);
    return `  ${operation}?: ${list ? `${type}[]` : type};`;
  });
  return `export interface ${name} {\n${members.join('\n')}\n}`;
}

/** Emit only the direct scalar and enum classes used by a source's fields. */
export function emitFilters(source: SourceIR): string {
  const scalars = new Set<string>();
  const enums = new Set<string>();
  for (const entity of Object.values(source.entities)) {
    for (const field of entity.fields) {
      const filter = filterClass(field);
      if (filter === null) continue;
      if (field.type.kind === 'enum') enums.add(field.type.ref);
      else scalars.add(filter);
    }
  }

  const enumNames = [...enums].sort((left, right) => left.localeCompare(right));
  const blocks: string[] = [];
  for (const name of SCALAR_FILTER_ORDER) {
    if (scalars.has(name))
      blocks.push(emitInterface(name, baseType(name), operations(name)));
  }
  for (const name of enumNames) {
    blocks.push(
      emitInterface(`Enum${name}Filter`, enumTypeName(name), [
        ...EQUALITY_OPS,
        ...LIST_OPS,
      ]),
    );
  }

  const imports =
    enumNames.length === 0
      ? ''
      : `import type { ${enumNames.map(enumTypeName).join(', ')} } from './enums';\n\n`;
  return blocks.length === 0
    ? 'export {};\n'
    : `${imports}${blocks.join('\n\n')}\n`;
}
