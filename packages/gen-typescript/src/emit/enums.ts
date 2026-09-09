/** Source enums -> the shared enums.ts module. */
import type { EnumDef, SourceIR } from '@kurotako/ir';
import { TypeScriptEnumCollisionError } from '../errors.js';
import { enumConst, enumTypeName } from '../names.js';

function sameValues(a: EnumDef, b: EnumDef): boolean {
  const left = a.values.map((value) => value.name);
  const right = b.values.map((value) => value.name);
  return (
    left.length === right.length && left.every((value, i) => value === right[i])
  );
}

/** All reachable definitions, deduplicated and sorted by their identifier. */
export function collectEnums(source: SourceIR): EnumDef[] {
  const byName = new Map<string, { definition: EnumDef; origin: string }>();
  const add = (definition: EnumDef, origin: string): void => {
    const previous = byName.get(definition.name);
    if (previous === undefined) {
      byName.set(definition.name, { definition, origin });
    } else if (!sameValues(previous.definition, definition)) {
      throw new TypeScriptEnumCollisionError(
        definition.name,
        previous.origin,
        origin,
      );
    }
  };

  for (const definition of Object.values(source.enums))
    add(definition, 'source-level');
  for (const entity of Object.values(source.entities)) {
    for (const definition of Object.values(entity.enums ?? {})) {
      add(definition, `entity '${entity.name}'`);
    }
  }

  return [...byName.values()]
    .map(({ definition }) => definition)
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Emit type/value enum pairs, which legally share an identifier in TypeScript. */
export function emitEnums(source: SourceIR): string {
  const blocks = collectEnums(source).map((definition) => {
    const values = definition.values
      .map((value) => JSON.stringify(value.name))
      .join(', ');
    const name = enumConst(definition.name);
    return `export const ${name} = [${values}] as const;\nexport type ${enumTypeName(definition.name)} = (typeof ${name})[number];`;
  });
  return blocks.length === 0 ? 'export {};\n' : `${blocks.join('\n\n')}\n`;
}
