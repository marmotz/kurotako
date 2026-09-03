/**
 * All enums of a source -> `<ns>/zod/enums.ts` source text.
 *
 * Every source-level and entity-local `EnumDef` is emitted (sorted by name,
 * de-duplicated). Two distinct defs sharing a name -> `ZodEnumCollisionError`.
 */
import type { EnumDef, SourceIR } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import { ZodEnumCollisionError } from '../errors.js';
import { enumConst, enumSchemaName, enumTypeName } from '../names.js';

function sameValues(a: EnumDef, b: EnumDef): boolean {
  const va = a.values.map((v) => v.name);
  const vb = b.values.map((v) => v.name);
  return va.length === vb.length && va.every((name, i) => name === vb[i]);
}

/**
 * Every reachable `EnumDef` of a source, sorted by name, de-duplicated.
 * Entity-local defs are tagged with their owning entity for the collision message.
 */
export function collectEnums(source: SourceIR): EnumDef[] {
  const byName = new Map<string, { def: EnumDef; origin: string }>();

  const add = (def: EnumDef, origin: string): void => {
    const seen = byName.get(def.name);
    if (seen === undefined) {
      byName.set(def.name, { def, origin });
      return;
    }
    if (!sameValues(seen.def, def)) {
      throw new ZodEnumCollisionError(def.name, seen.origin, origin);
    }
  };

  for (const def of Object.values(source.enums)) {
    add(def, 'source-level');
  }
  for (const entity of Object.values(source.entities)) {
    for (const def of Object.values(entity.enums ?? {})) {
      add(def, `entity '${entity.name}'`);
    }
  }

  return [...byName.values()]
    .map((e) => e.def)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function emitEnums(source: SourceIR, _dialect: ZodDialect): string {
  const defs = collectEnums(source);
  const lines: string[] = ["import { z } from 'zod';", ''];

  for (const def of defs) {
    const values = def.values.map((v) => JSON.stringify(v.name)).join(', ');
    lines.push(
      `export const ${enumConst(def.name)} = [${values}] as const;`,
      `export const ${enumSchemaName(def.name)} = z.enum(${enumConst(def.name)});`,
      `export type ${enumTypeName(def.name)} = (typeof ${enumConst(def.name)})[number];`,
      '',
    );
  }

  return `${lines.join('\n').trimEnd()}\n`;
}
