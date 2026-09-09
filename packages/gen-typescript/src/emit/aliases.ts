/** Source type aliases -> the shared aliases.ts declaration module. */
import type { SourceIR } from '@kurotako/ir';
import { typeName } from '../names.js';
import { collectTypeDependencies, renderFieldType } from '../render/scalars.js';

/** Emit source aliases and imports for their external entity/enum dependencies. */
export function emitAliases(source: SourceIR): string {
  const aliases = Object.values(source.typeAliases ?? {});
  const enums = new Set<string>();
  const entityRefs = new Set<string>();
  let usesJsonValue = false;

  for (const alias of aliases) {
    const dependencies = collectTypeDependencies(alias.type, source, undefined);
    for (const name of dependencies.enums) enums.add(name);
    for (const name of dependencies.entityRefs) entityRefs.add(name);
    usesJsonValue ||= dependencies.usesJsonValue;
  }

  const imports: Array<{ specifier: string; names: string[] }> = [];
  if (enums.size > 0) {
    imports.push({ specifier: './enums', names: [...enums] });
  }
  if (usesJsonValue) {
    imports.push({ specifier: './scalars', names: ['JsonValue'] });
  }
  for (const ref of entityRefs) {
    imports.push({
      specifier: `./${ref}.type`,
      names: [typeName(ref)],
    });
  }

  const blocks = aliases.map((alias) => {
    const doc = alias.doc === undefined ? '' : `/** ${alias.doc} */\n`;
    return `${doc}export type ${alias.name} = ${renderFieldType(alias.type, source)};`;
  });
  const importBlock = imports
    .sort((left, right) => left.specifier.localeCompare(right.specifier))
    .map(
      ({ specifier, names }) =>
        `import type { ${names.sort((left, right) => left.localeCompare(right)).join(', ')} } from '${specifier}';`,
    )
    .join('\n');

  return `${[importBlock, ...blocks].filter((block) => block !== '').join('\n\n')}\n`;
}
