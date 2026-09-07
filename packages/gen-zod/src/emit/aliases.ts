/**
 * All type aliases of a source -> `<ns>/zod/aliases.ts` source text.
 *
 * Per alias: `export type <Name> = <ts type>;` then
 * `export const <Name>Schema: z.ZodType<<Name>> = <expr>;`. The type is emitted
 * first and the `const` is always annotated so a self- or mutually-recursive
 * alias (`z.lazy` chain) type-checks — `z.infer` on a recursive `z.lazy` is
 * `TS7022`. Aliases are sorted by name; cross-references between aliases live in
 * the same module, so only enum schemas and referenced entity schemas are
 * imported.
 */
import type { SourceIR } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import {
  aliasSchemaName,
  aliasTypeName,
  refSchemaName,
  typeName,
} from '../names.js';
import { baseExpr, collectTypeDeps, typeExpr } from '../render/scalars.js';

export function emitAliases(source: SourceIR, dialect: ZodDialect): string {
  const aliases = Object.values(source.typeAliases ?? {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const aliasNames = new Set(aliases.map((a) => a.name));
  const enums = new Set<string>();
  const entityRefs = new Set<string>();
  for (const alias of aliases) {
    const deps = collectTypeDeps(alias.type);
    for (const e of deps.enums) {
      enums.add(e);
    }
    for (const ref of deps.refs) {
      if (!aliasNames.has(ref)) {
        entityRefs.add(ref);
      }
    }
  }

  const imports: { spec: string; stmt: string }[] = [
    { spec: 'zod', stmt: "import { z } from 'zod';" },
  ];
  if (enums.size > 0) {
    const names = [...enums].sort((a, b) => a.localeCompare(b)).join(', ');
    imports.push({
      spec: './enums',
      stmt: `import { ${names} } from './enums';`,
    });
  }
  for (const ref of [...entityRefs].sort((a, b) => a.localeCompare(b))) {
    const spec = `./${ref}.schema`;
    imports.push({
      spec,
      stmt: `import { ${refSchemaName(ref)}, type ${typeName(ref)} } from '${spec}';`,
    });
  }

  const blocks: string[] = [];
  for (const alias of aliases) {
    const aliasTs = aliasTypeName(alias.name);
    if (alias.doc !== undefined) {
      blocks.push(`/** ${alias.doc} */`);
    }
    blocks.push(
      `export type ${aliasTs} = ${typeExpr(alias.type, source)};`,
      `export const ${aliasSchemaName(alias.name)}: z.ZodType<${aliasTs}> = ${baseExpr(
        alias.type,
        dialect,
      )};`,
      '',
    );
  }

  const importBlock = imports
    .sort((a, b) => a.spec.localeCompare(b.spec))
    .map((l) => l.stmt)
    .join('\n');

  return `${[importBlock, '', ...blocks].join('\n').trimEnd()}\n`;
}
