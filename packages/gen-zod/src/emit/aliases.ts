/**
 * All type aliases of a source -> `<ns>/zod/aliases.ts` source text.
 *
 * Aliases are emitted in **topological order** (a bare reference is always
 * declared before it is used); a dependency that is itself in a reference cycle
 * imposes no ordering constraint, since it is reached through `z.lazy`.
 *
 * Per non-recursive alias:
 *   `export const <Name>Schema = <expr>;`
 *   `export type <Name> = z.infer<typeof <Name>Schema>;`
 *
 * Per alias that takes part in a reference cycle (`cyclicRefs`): the type is
 * hand-written and the `const` is annotated `z.ZodType<<Name>>`, because
 * `z.infer` on a self-/mutually-recursive `z.lazy` chain is `TS7022`.
 */
import type { SourceIR, TypeAlias } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import {
  aliasSchemaName,
  aliasTypeName,
  refSchemaName,
  typeName,
} from '../names.js';
import { baseExpr, collectTypeDeps, typeExpr } from '../render/scalars.js';

/**
 * Order aliases so every bare (non-cyclic) alias-to-alias reference is declared
 * first. A cyclic dependency is skipped as an edge — it is `z.lazy`-wrapped, so
 * its declaration position does not matter.
 */
function orderAliases(
  aliases: TypeAlias[],
  cyclicRefs: ReadonlySet<string>,
): TypeAlias[] {
  const byName = new Map(aliases.map((a) => [a.name, a]));
  const sorted = [...aliases].sort((a, b) => a.name.localeCompare(b.name));
  const out: TypeAlias[] = [];
  const done = new Set<string>();

  const visit = (alias: TypeAlias, stack: Set<string>): void => {
    if (done.has(alias.name) || stack.has(alias.name)) {
      return;
    }
    stack.add(alias.name);
    const deps = [...collectTypeDeps(alias.type).refs].sort((a, b) =>
      a.localeCompare(b),
    );
    for (const dep of deps) {
      if (cyclicRefs.has(dep)) {
        continue;
      }
      const target = byName.get(dep);
      if (target !== undefined) {
        visit(target, stack);
      }
    }
    stack.delete(alias.name);
    done.add(alias.name);
    out.push(alias);
  };

  for (const alias of sorted) {
    visit(alias, new Set());
  }
  return out;
}

export function emitAliases(
  source: SourceIR,
  dialect: ZodDialect,
  cyclicRefs: ReadonlySet<string> = new Set(),
): string {
  const declared = Object.values(source.typeAliases ?? {});
  const aliases = orderAliases(declared, cyclicRefs);

  const aliasNames = new Set(declared.map((a) => a.name));
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
    const schemaId = aliasSchemaName(alias.name);
    const expr = baseExpr(alias.type, dialect, cyclicRefs);
    if (alias.doc !== undefined) {
      blocks.push(`/** ${alias.doc} */`);
    }
    if (cyclicRefs.has(alias.name)) {
      blocks.push(
        `export type ${aliasTs} = ${typeExpr(alias.type, source)};`,
        `export const ${schemaId}: z.ZodType<${aliasTs}> = ${expr};`,
        '',
      );
    } else {
      blocks.push(
        `export const ${schemaId} = ${expr};`,
        `export type ${aliasTs} = z.infer<typeof ${schemaId}>;`,
        '',
      );
    }
  }

  const importBlock = imports
    .sort((a, b) => a.spec.localeCompare(b.spec))
    .map((l) => l.stmt)
    .join('\n');

  return `${[importBlock, '', ...blocks].join('\n').trimEnd()}\n`;
}
