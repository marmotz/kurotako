/**
 * One entity -> `<ns>/zod/<entity>.schema.ts` source text: a sorted import block
 * then, for each of the 5 variants x 2 families, an
 * `export const <Name>Schema = …` plus its `export type <Name>Dto = z.infer<…>`.
 */

import type { Logger } from '@kurotako/core';
import type { Entity, IR, SourceIR } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import {
  enumSchemaName,
  FAMILIES,
  FAMILY_TOKEN,
  type FamilyName,
  schemaName,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type VariantName,
} from '../names.js';
import { fieldExpr } from '../render/field.js';
import { relationExpr } from '../render/relations.js';
import { filterClass, variantFields } from '../render/variants.js';

type Entry = [name: string, expr: string];

function objectExpr(entries: Entry[]): string {
  if (entries.length === 0) {
    return 'z.object({})';
  }
  const body = entries.map(([k, v]) => `  ${k}: ${v},`).join('\n');
  return `z.object({\n${body}\n})`;
}

export function emitEntity(
  _ir: IR,
  source: SourceIR,
  entity: Entity,
  dialect: ZodDialect,
  logger?: Logger,
): string {
  const ns = source.namespace;
  const usedEnumSchemas = new Set<string>();
  const usedFilters = new Set<string>();
  const usedSiblings = new Map<string, Set<string>>();

  const trackSibling = (target: string, symbol: string): void => {
    if (target === entity.name) {
      return;
    }
    const set = usedSiblings.get(target) ?? new Set<string>();
    set.add(symbol);
    usedSiblings.set(target, set);
  };

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
      const body = renderBody(variant, family, name);
      blocks.push(
        `export const ${name} = ${body};`,
        `export type ${dto} = z.infer<typeof ${name}>;`,
        '',
      );
    }
  }

  const imports = buildImports(ns, usedEnumSchemas, usedFilters, usedSiblings);
  return `${[imports, '', ...blocks].join('\n').trimEnd()}\n`;

  function renderBody(
    variant: VariantName,
    family: FamilyName,
    selfName: string,
  ): string {
    if (variant === 'where') {
      return renderWhere(family, selfName);
    }
    if (variant === 'select') {
      return renderSelect(family);
    }
    return renderRecord(variant, family);
  }

  function renderRecord(
    variant: Exclude<VariantName, 'where' | 'select'>,
    family: FamilyName,
  ): string {
    const entries: Entry[] = [];
    for (const sel of variantFields(entity, variant)) {
      if (sel.field.type.kind === 'enum') {
        usedEnumSchemas.add(enumSchemaName(sel.field.type.ref));
      }
      entries.push([
        sel.field.name,
        fieldExpr(
          sel.field,
          { optional: variant === 'update' ? false : sel.optional, variant },
          dialect,
        ),
      ]);
    }
    if (family === 'deep') {
      for (const rel of entity.relations) {
        const expr = relationExpr(rel, 'deep', variant, {
          fromNamespace: ns,
          logger,
        });
        if (expr !== null) {
          entries.push([rel.name, expr]);
          trackSibling(
            rel.target.entity,
            schemaName(rel.target.entity, VARIANT_TOKEN[variant], 'Deep'),
          );
        }
      }
    }
    const obj = objectExpr(entries);
    return variant === 'update' ? `${obj}.partial()` : obj;
  }

  function renderWhere(family: FamilyName, selfName: string): string {
    const entries: Entry[] = [];
    for (const field of entity.fields) {
      const cls = filterClass(field);
      if (cls === null) {
        continue;
      }
      usedFilters.add(cls);
      entries.push([field.name, `${cls}.optional()`]);
    }
    if (family === 'deep') {
      for (const rel of entity.relations) {
        const expr = relationExpr(rel, 'deep', 'where', {
          fromNamespace: ns,
          logger,
        });
        if (expr !== null) {
          entries.push([rel.name, expr]);
          trackSibling(
            rel.target.entity,
            schemaName(rel.target.entity, 'Where', 'Deep'),
          );
        }
      }
    }
    const logic = `z.union([${selfName}, z.array(${selfName})]).optional()`;
    entries.push(['AND', logic], ['OR', logic], ['NOT', logic]);
    return `z.lazy(() => ${objectExpr(entries)})`;
  }

  function renderSelect(family: FamilyName): string {
    const entries: Entry[] = entity.fields.map((field) => [
      field.name,
      'z.boolean().optional()',
    ]);
    for (const rel of entity.relations) {
      if (family === 'flat') {
        entries.push([rel.name, 'z.boolean().optional()']);
        continue;
      }
      const expr = relationExpr(rel, 'deep', 'select', {
        fromNamespace: ns,
        logger,
      });
      if (expr === null) {
        entries.push([rel.name, 'z.boolean().optional()']);
      } else {
        entries.push([rel.name, expr]);
        trackSibling(
          rel.target.entity,
          schemaName(rel.target.entity, 'Select', 'Deep'),
        );
      }
    }
    return objectExpr(entries);
  }
}

function buildImports(
  _ns: string,
  enums: Set<string>,
  filters: Set<string>,
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
