/**
 * Shared Where operator schemas -> `<ns>/zod/filters.ts` source text.
 *
 * Prisma-style: one schema per scalar class actually used by a field in the
 * source. `Enum<Name>Filter` imports its enum from `./enums`. All entries
 * optional (`.partial()`).
 */
import type { SourceIR } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import { enumFilterName, enumSchemaName } from '../names.js';
import { filterClass } from '../render/variants.js';

const EQUALITY_OPS = ['equals', 'not'] as const;
const LIST_OPS = ['in', 'notIn'] as const;
const ORDER_OPS = ['lt', 'lte', 'gt', 'gte'] as const;
const STRING_OPS = ['contains', 'startsWith', 'endsWith'] as const;

/** Canonical emission order for the built-in scalar filter classes. */
const SCALAR_FILTER_ORDER = [
  'StringFilter',
  'IntFilter',
  'FloatFilter',
  'BigIntFilter',
  'DateTimeFilter',
  'BoolFilter',
] as const;

interface FilterSpec {
  name: string;
  base: string;
  ops: readonly string[];
}

function scalarBase(name: string, dialect: ZodDialect): string {
  switch (name) {
    case 'StringFilter':
      return 'z.string()';
    case 'IntFilter':
      return dialect.scalarInt();
    case 'FloatFilter':
      return 'z.number()';
    case 'BigIntFilter':
      return 'z.bigint()';
    case 'DateTimeFilter':
      return 'z.coerce.date()';
    case 'BoolFilter':
      return 'z.boolean()';
    default:
      return 'z.unknown()';
  }
}

function scalarOps(name: string): readonly string[] {
  if (name === 'BoolFilter') {
    return EQUALITY_OPS;
  }
  if (name === 'StringFilter') {
    return [...EQUALITY_OPS, ...LIST_OPS, ...ORDER_OPS, ...STRING_OPS];
  }
  return [...EQUALITY_OPS, ...LIST_OPS, ...ORDER_OPS];
}

function renderFilter(spec: FilterSpec): string {
  const entries = spec.ops.map((op) => {
    const isList = (LIST_OPS as readonly string[]).includes(op);
    const value = isList
      ? `z.array(${spec.base}).optional()`
      : `${spec.base}.optional()`;
    return `  ${op}: ${value},`;
  });
  return `export const ${spec.name} = z.object({\n${entries.join('\n')}\n}).partial();`;
}

export function emitFilters(source: SourceIR, dialect: ZodDialect): string {
  const scalarUsed = new Set<string>();
  const enumUsed = new Set<string>();

  for (const entity of Object.values(source.entities)) {
    for (const field of entity.fields) {
      const cls = filterClass(field);
      if (cls === null) {
        continue;
      }
      if (field.type.kind === 'enum') {
        enumUsed.add(field.type.ref);
      } else {
        scalarUsed.add(cls);
      }
    }
  }

  const specs: FilterSpec[] = [];
  for (const name of SCALAR_FILTER_ORDER) {
    if (scalarUsed.has(name)) {
      specs.push({
        name,
        base: scalarBase(name, dialect),
        ops: scalarOps(name),
      });
    }
  }
  for (const enumName of [...enumUsed].sort((a, b) => a.localeCompare(b))) {
    specs.push({
      name: enumFilterName(enumName),
      base: enumSchemaName(enumName),
      ops: [...EQUALITY_OPS, ...LIST_OPS],
    });
  }

  const imports = ["import { z } from 'zod';"];
  if (enumUsed.size > 0) {
    const names = [...enumUsed]
      .sort((a, b) => a.localeCompare(b))
      .map((n) => enumSchemaName(n))
      .join(', ');
    imports.push(`import { ${names} } from './enums';`);
  }

  return `${[imports.join('\n'), '', ...specs.map(renderFilter)].join('\n').trimEnd()}\n`;
}
