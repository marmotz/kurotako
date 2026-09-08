/**
 * One entity -> `<ns>/zod/<entity>.schema.ts` source text: a sorted import block
 * then, for each of the 5 variants x 2 families, an
 * `export const <Name>Schema = …` plus its `export type <Name>Dto = …`.
 *
 * A `deep`-family schema with relations gets a hand-composed `Dto` type (not a
 * plain `z.infer<typeof <name>Schema>`) plus an explicit `z.ZodType<Dto>`
 * annotation on the exported const. Reason: two entities with relations
 * pointing at each other (the ordinary shape of a Prisma one-to-many /
 * many-to-one pair, not an edge case) make every relation-carrying
 * `z.object(...)` mutually circular — TypeScript can't emit a `.d.ts` for a
 * value whose type can only be inferred by inferring the other value's type,
 * which in turn needs this one's (TS7022 / TS7024, or worse TS2502 /
 * TS2456 once two such untyped consts reference each other). The fix: split
 * off an unexported `<name>Base` holding only the non-relation fields (its
 * `z.infer` is circularity-free), and hand-write the relation-carrying part
 * of `Dto` naming the *target*'s `Dto` directly — mutually recursive `type`
 * aliases are fine in TS, only mutually inferred const initializers are not.
 */

import type { Logger } from '@kurotako/core';
import type { Entity, Field, IR, SourceIR } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import {
  aliasSchemaName,
  aliasTypeName,
  FAMILIES,
  FAMILY_TOKEN,
  type FamilyName,
  refSchemaName,
  schemaName,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type Variant,
  type VariantName,
} from '../names.js';
import { fieldExpr } from '../render/field.js';
import {
  type RelationType,
  relationExpr,
  relationTypeExpr,
} from '../render/relations.js';
import { collectTypeDeps, typeExpr } from '../render/scalars.js';
import { filterClass, variantFields } from '../render/variants.js';

type Entry = [name: string, expr: string];
type TypedEntry = [name: string, type: RelationType];

function objectExpr(entries: Entry[]): string {
  if (entries.length === 0) {
    return 'z.object({})';
  }
  const body = entries.map(([k, v]) => `  ${k}: ${v},`).join('\n');
  return `z.object({\n${body}\n})`;
}

function extendExpr(baseName: string, entries: Entry[]): string {
  const body = entries.map(([k, v]) => `  ${k}: ${v},`).join('\n');
  return `${baseName}.extend({\n${body}\n})`;
}

function typeIntersection(entries: TypedEntry[]): string {
  if (entries.length === 0) {
    return '';
  }
  const body = entries
    .map(([k, t]) => `  ${k}${t.optional ? '?' : ''}: ${t.type};`)
    .join('\n');
  return ` & {\n${body}\n}`;
}

export function emitEntity(
  _ir: IR,
  source: SourceIR,
  entity: Entity,
  dialect: ZodDialect,
  logger?: Logger,
  cyclicRefs: ReadonlySet<string> = new Set(),
): string {
  const ns = source.namespace;
  const usedEnumSchemas = new Set<string>();
  const usedFilters = new Set<string>();
  /** Type-alias names referenced by a field type — imported from `./aliases`. */
  const usedAliases = new Set<string>();
  const usedSiblings = new Map<string, Set<string>>();

  const trackSibling = (target: string, symbol: string): void => {
    if (target === entity.name) {
      return;
    }
    const set = usedSiblings.get(target) ?? new Set<string>();
    set.add(symbol);
    usedSiblings.set(target, set);
  };

  /** Record enum / alias / sibling-entity schema imports for a field type. */
  const recordTypeDeps = (field: Field): void => {
    const deps = collectTypeDeps(field.type);
    for (const e of deps.enums) {
      usedEnumSchemas.add(e);
    }
    for (const ref of deps.refs) {
      if (source.entities[ref] !== undefined) {
        trackSibling(ref, refSchemaName(ref));
        trackSibling(ref, typeName(ref));
      } else {
        usedAliases.add(ref);
      }
    }
  };

  /** Hand-written TS type for a field — mirrors `fieldExpr`'s wrappers. */
  const fieldTsType = (field: Field): string => {
    let t = typeExpr(field.type, source);
    if (field.type.kind === 'union') {
      t = `(${t})`;
    }
    if (field.list) {
      t = `${t}[]`;
    }
    if (field.nullable) {
      t = `${t} | null`;
    }
    return t;
  };

  /** Every non-flat relation on `entity`, with its runtime expr + TS type. */
  function collectRelations(
    variant: VariantName,
    relSchemaFamily: Variant,
  ): { entries: Entry[]; typed: TypedEntry[] } {
    const entries: Entry[] = [];
    const typed: TypedEntry[] = [];
    for (const rel of entity.relations) {
      const expr = relationExpr(rel, 'deep', variant, {
        fromNamespace: ns,
        logger,
      });
      if (expr === null) {
        continue;
      }
      entries.push([rel.name, expr]);
      trackSibling(
        rel.target.entity,
        schemaName(rel.target.entity, relSchemaFamily, 'Deep'),
      );
      const type = relationTypeExpr(rel, 'deep', variant, {
        fromNamespace: ns,
        logger,
      });
      if (type !== null) {
        typed.push([rel.name, type]);
        trackSibling(
          rel.target.entity,
          typeName(rel.target.entity, relSchemaFamily, 'Deep'),
        );
      }
    }
    return { entries, typed };
  }

  const blocks: string[] = [];

  for (const variant of VARIANTS) {
    for (const family of FAMILIES) {
      const name = schemaName(
        entity.name,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
      const dto = typeName(
        entity.name,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
      if (variant === 'where') {
        blocks.push(...renderWhereBlock(family, name, dto));
        continue;
      }
      if (variant === 'select') {
        blocks.push(...renderSelectBlock(family, name, dto));
        continue;
      }
      blocks.push(...renderRecordBlock(variant, family, name, dto));
    }
  }

  const imports = buildImports(
    usedEnumSchemas,
    usedFilters,
    usedAliases,
    usedSiblings,
  );
  return `${[imports, '', ...blocks].join('\n').trimEnd()}\n`;

  function renderRecordBlock(
    variant: Exclude<VariantName, 'where' | 'select'>,
    family: FamilyName,
    name: string,
    dto: string,
  ): string[] {
    const selections = variantFields(entity, variant);
    const ownEntries: Entry[] = [];
    let ownHasRef = false;
    for (const sel of selections) {
      recordTypeDeps(sel.field);
      if (collectTypeDeps(sel.field.type).refs.size > 0) {
        ownHasRef = true;
      }
      ownEntries.push([
        sel.field.name,
        fieldExpr(
          sel.field,
          { optional: variant === 'update' ? false : sel.optional, variant },
          dialect,
          cyclicRefs,
        ),
      ]);
    }

    const { entries: relEntries, typed: relTyped } =
      family === 'deep'
        ? collectRelations(variant, VARIANT_TOKEN[variant])
        : { entries: [], typed: [] };

    if (relEntries.length === 0) {
      const obj = objectExpr(ownEntries);
      const body = variant === 'update' ? `${obj}.partial()` : obj;
      if (!ownHasRef) {
        return [
          `export const ${name} = ${body};`,
          `export type ${dto} = z.infer<typeof ${name}>;`,
          '',
        ];
      }
      // A `ref` field renders as a `z.lazy` chain — `z.infer` on it is `TS7022`
      // once the reference is recursive. Annotate the const and hand-write the
      // DTO from the field types.
      const rows = selections
        .map((sel) => {
          const opt = variant === 'update' || sel.optional;
          return `  ${sel.field.name}${opt ? '?' : ''}: ${fieldTsType(sel.field)};`;
        })
        .join('\n');
      return [
        `export const ${name}: z.ZodType<${dto}> = ${body};`,
        `export type ${dto} = {\n${rows}\n};`,
        '',
      ];
    }

    const baseName = `${name}Base`;
    const extended = extendExpr(baseName, relEntries);
    const finalValue =
      variant === 'update' ? `${extended}.partial()` : extended;
    const ownDtoExpr =
      variant === 'update'
        ? `Partial<z.infer<typeof ${baseName}>>`
        : `z.infer<typeof ${baseName}>`;

    return [
      `const ${baseName} = ${objectExpr(ownEntries)};`,
      `export const ${name}: z.ZodType<${dto}> = ${finalValue};`,
      `export type ${dto} = ${ownDtoExpr}${typeIntersection(relTyped)};`,
      '',
    ];
  }

  function renderWhereBlock(
    family: FamilyName,
    name: string,
    dto: string,
  ): string[] {
    const ownEntries: Entry[] = [];
    for (const field of entity.fields) {
      const cls = filterClass(field);
      if (cls === null) {
        continue;
      }
      usedFilters.add(cls);
      ownEntries.push([field.name, `${cls}.optional()`]);
    }

    const { entries: relEntries, typed: relTyped } =
      family === 'deep'
        ? collectRelations('where', 'Where')
        : { entries: [], typed: [] };

    const baseName = `${name}Base`;
    const logic = `z.union([${name}, z.array(${name})]).optional()`;
    const logicEntries: Entry[] = [
      ...relEntries,
      ['AND', logic],
      ['OR', logic],
      ['NOT', logic],
    ];

    return [
      `const ${baseName} = ${objectExpr(ownEntries)};`,
      `export const ${name}: z.ZodType<${dto}> = z.lazy(() => ${extendExpr(baseName, logicEntries)});`,
      `export type ${dto} = z.infer<typeof ${baseName}>${typeIntersection(relTyped)} & { AND?: ${dto} | ${dto}[]; OR?: ${dto} | ${dto}[]; NOT?: ${dto} | ${dto}[]; };`,
      '',
    ];
  }

  function renderSelectBlock(
    family: FamilyName,
    name: string,
    dto: string,
  ): string[] {
    const ownEntries: Entry[] = entity.fields.map((field) => [
      field.name,
      'z.boolean().optional()',
    ]);

    if (family === 'flat') {
      for (const rel of entity.relations) {
        ownEntries.push([rel.name, 'z.boolean().optional()']);
      }
      const obj = objectExpr(ownEntries);
      return [
        `export const ${name} = ${obj};`,
        `export type ${dto} = z.infer<typeof ${name}>;`,
        '',
      ];
    }

    const relEntries: Entry[] = [];
    const relTyped: TypedEntry[] = [];
    for (const rel of entity.relations) {
      const expr = relationExpr(rel, 'deep', 'select', {
        fromNamespace: ns,
        logger,
      });
      if (expr === null) {
        ownEntries.push([rel.name, 'z.boolean().optional()']);
        continue;
      }
      relEntries.push([rel.name, expr]);
      trackSibling(
        rel.target.entity,
        schemaName(rel.target.entity, 'Select', 'Deep'),
      );
      const type = relationTypeExpr(rel, 'deep', 'select', {
        fromNamespace: ns,
        logger,
      });
      if (type !== null) {
        relTyped.push([rel.name, type]);
        trackSibling(
          rel.target.entity,
          typeName(rel.target.entity, 'Select', 'Deep'),
        );
      }
    }

    if (relEntries.length === 0) {
      const obj = objectExpr(ownEntries);
      return [
        `export const ${name} = ${obj};`,
        `export type ${dto} = z.infer<typeof ${name}>;`,
        '',
      ];
    }

    const baseName = `${name}Base`;
    return [
      `const ${baseName} = ${objectExpr(ownEntries)};`,
      `export const ${name}: z.ZodType<${dto}> = ${extendExpr(baseName, relEntries)};`,
      `export type ${dto} = z.infer<typeof ${baseName}>${typeIntersection(relTyped)};`,
      '',
    ];
  }
}

function buildImports(
  enums: Set<string>,
  filters: Set<string>,
  aliases: Set<string>,
  siblings: Map<string, Set<string>>,
): string {
  const lines: { spec: string; stmt: string }[] = [
    { spec: 'zod', stmt: "import { z } from 'zod';" },
  ];

  if (enums.size > 0) {
    const names = [...enums].sort((a, b) => a.localeCompare(b)).join(', ');
    lines.push({
      spec: './enums',
      stmt: `import { ${names} } from './enums';`,
    });
  }
  if (aliases.size > 0) {
    const names = [...aliases]
      .sort((a, b) => a.localeCompare(b))
      .flatMap((n) => [aliasSchemaName(n), `type ${aliasTypeName(n)}`])
      .join(', ');
    lines.push({
      spec: './aliases',
      stmt: `import { ${names} } from './aliases';`,
    });
  }
  if (filters.size > 0) {
    const names = [...filters].sort((a, b) => a.localeCompare(b)).join(', ');
    lines.push({
      spec: './filters',
      stmt: `import { ${names} } from './filters';`,
    });
  }
  for (const target of [...siblings.keys()].sort((a, b) =>
    a.localeCompare(b),
  )) {
    const names = [...(siblings.get(target) ?? [])]
      .sort((a, b) => a.localeCompare(b))
      .join(', ');
    const spec = `./${target}.schema`;
    lines.push({ spec, stmt: `import { ${names} } from '${spec}';` });
  }

  return lines
    .sort((a, b) => a.spec.localeCompare(b.spec))
    .map((l) => l.stmt)
    .join('\n');
}
