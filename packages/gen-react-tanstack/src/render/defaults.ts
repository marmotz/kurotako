/**
 * `default<Entity><Variant>FormValues` rendering: one `key: value` line per field of
 * the variant, then (deep mode) per followed relation. Initial values come from the
 * shared `formInitExpr` helper of `@kurotako/ir`; a `ref` / non-discriminated `union`
 * field has no synthesisable zero and is seeded `undefined`, cast to the exact values
 * field type (the Zod schema flags it until it is filled).
 */
import type { Entity, EnumZero, Field, SourceIR } from '@kurotako/ir';
import { formInitExpr, resolveEnum } from '@kurotako/ir';
import { defaultValuesName, entityModule } from '../names.js';
import {
  cutFields,
  followedRelations,
  isToOneCycle,
  type ValuesContext,
} from './values.js';
import { variantFields } from './variants.js';

/** `EnumZero` backed by the IR: the enum's first declared member, in source order. */
export function enumZeroFromSource(source: SourceIR, entity: Entity): EnumZero {
  return (ref) => resolveEnum(source, entity, ref)?.values[0]?.name;
}

function fieldLine(
  field: Field,
  valuesType: string,
  enumZero: EnumZero,
): string {
  const expr = formInitExpr(field, enumZero);
  if (expr === 'undefined') {
    // No synthesisable zero (`ref`, non-discriminated `union`, `json`, unresolved
    // enum): seed `undefined`, cast to the exact values field type.
    return `    ${field.name}: (init?.${field.name} ?? undefined) as ${valuesType}[${JSON.stringify(field.name)}],`;
  }
  return `    ${field.name}: init?.${field.name} ?? ${expr},`;
}

/** The `export function default<Entity><Variant>FormValues(...)` text. */
export function defaultValuesFunction(
  entity: Entity,
  valuesType: string,
  ctx: ValuesContext,
  emitted: ReadonlySet<string>,
): string {
  const enumZero = enumZeroFromSource(ctx.source, entity);
  const cut = cutFields(entity, ctx);
  const lines = variantFields(entity, ctx.variant)
    .filter((field) => !cut.has(field.name))
    .map((field) => fieldLine(field, valuesType, enumZero));

  for (const rel of followedRelations(entity, ctx)) {
    const name = rel.relation.name;
    if (rel.many) {
      lines.push(`    ${name}: init?.${name} ?? [],`);
      continue;
    }
    const target = rel.relation.target.entity;
    const cyclic =
      ctx.cycles.has(`${ctx.namespace}.${target}`) ||
      isToOneCycle(entity.name, target, ctx);
    if (cyclic || !emitted.has(target)) {
      ctx.logger?.debug(
        cyclic
          ? `gen-react-tanstack: relation '${name}' targets '${target}', which recurses back; not seeding a nested default`
          : `gen-react-tanstack: relation '${name}' targets '${target}', which is not emitted (see 'include'); not seeding a nested default`,
      );
      lines.push(
        `    ${name}: (init?.${name} ?? undefined) as ${valuesType}[${JSON.stringify(name)}],`,
      );
      continue;
    }
    const targetFn = defaultValuesName(target, ctx.variant);
    ctx.imports.value(entityModule(ctx.namespace, target), targetFn);
    lines.push(`    ${name}: ${targetFn}(init?.${name}),`);
  }

  const name = defaultValuesName(entity.name, ctx.variant);
  const body = lines.length === 0 ? '{}' : `{\n${lines.join('\n')}\n  }`;
  return `export function ${name}(init?: Partial<${valuesType}>): ${valuesType} {\n  return ${body};\n}`;
}
