/** One entity -> its ten flat/deep TypeScript declaration variants. */
import type { Logger } from '@kurotako/core';
import type { Entity, SourceIR } from '@kurotako/ir';
import {
  FAMILIES,
  FAMILY_TOKEN,
  type FamilyName,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type VariantName,
} from '../names.js';
import { memberLine } from '../render/field.js';
import { type RelationMember, relationMember } from '../render/relations.js';
import { collectTypeDependencies } from '../render/scalars.js';
import { filterClass, variantFields } from '../render/variants.js';

function typeBlock(name: string, members: string[]): string {
  return `export type ${name} = {\n${members.join('\n')}\n};`;
}

function relationLine(name: string, member: RelationMember): string {
  return `  ${name}${member.optional ? '?' : ''}: ${member.type};`;
}

/** Emit a type-only, specifier-sorted import block. */
function importsFor(
  enums: Set<string>,
  aliases: Set<string>,
  filters: Set<string>,
  usesJsonValue: boolean,
  siblings: Map<string, Set<string>>,
): string {
  const imports: Array<{ specifier: string; names: string[] }> = [];
  if (aliases.size > 0) {
    imports.push({ specifier: './aliases', names: [...aliases] });
  }
  if (enums.size > 0) {
    imports.push({ specifier: './enums', names: [...enums] });
  }
  if (filters.size > 0) {
    imports.push({ specifier: './filters', names: [...filters] });
  }
  if (usesJsonValue) {
    imports.push({ specifier: './scalars', names: ['JsonValue'] });
  }
  for (const [entity, names] of siblings) {
    imports.push({ specifier: `./${entity}.type`, names: [...names] });
  }
  return imports
    .sort((left, right) => left.specifier.localeCompare(right.specifier))
    .map(
      ({ specifier, names }) =>
        `import type { ${names.sort((left, right) => left.localeCompare(right)).join(', ')} } from '${specifier}';`,
    )
    .join('\n');
}

/** Render an entity's complete variant/family matrix. */
export function emitEntity(
  source: SourceIR,
  entity: Entity,
  logger?: Logger,
): string {
  const usedEnums = new Set<string>();
  const usedAliases = new Set<string>();
  const usedEntityRefs = new Set<string>();
  let usesJsonValue = false;
  const usedFilters = new Set<string>();
  const siblings = new Map<string, Set<string>>();

  for (const field of entity.fields) {
    const dependencies = collectTypeDependencies(field.type, source, entity);
    for (const name of dependencies.enums) usedEnums.add(name);
    for (const name of dependencies.aliases) usedAliases.add(name);
    for (const name of dependencies.entityRefs) usedEntityRefs.add(name);
    usesJsonValue ||= dependencies.usesJsonValue;
  }

  const trackSibling = (target: string, name: string): void => {
    if (target === entity.name) return;
    const names = siblings.get(target) ?? new Set<string>();
    names.add(name);
    siblings.set(target, names);
  };

  for (const ref of usedEntityRefs) {
    trackSibling(ref, typeName(ref));
  }

  const relation = (
    relationIndex: number,
    variant: VariantName,
  ): RelationMember | null => {
    const current = entity.relations[relationIndex];
    if (current === undefined) return null;
    const member = relationMember(current, 'deep', variant, {
      fromNamespace: source.namespace,
      logger,
    });
    if (member !== null) {
      trackSibling(
        current.target.entity,
        typeName(current.target.entity, VARIANT_TOKEN[variant], 'Deep'),
      );
    }
    return member;
  };

  const blocks: string[] = [];
  for (const variant of VARIANTS) {
    for (const family of FAMILIES) {
      const name = typeName(
        entity.name,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
      if (variant === 'where') {
        blocks.push(renderWhere(name, family));
      } else if (variant === 'select') {
        blocks.push(renderSelect(name, family));
      } else {
        blocks.push(renderRecord(name, variant, family));
      }
    }
  }

  const imports = importsFor(
    usedEnums,
    usedAliases,
    usedFilters,
    usesJsonValue,
    siblings,
  );
  return `${[imports, '', ...blocks].join('\n\n').trim()}\n`;

  function renderRecord(
    name: string,
    variant: Exclude<VariantName, 'where' | 'select'>,
    family: FamilyName,
  ): string {
    const own = variantFields(entity, variant).map((selection) =>
      memberLine(
        selection.field,
        { optional: variant === 'update' ? false : selection.optional },
        source,
        entity,
      ),
    );
    const relations: string[] = [];
    if (family === 'deep') {
      for (let index = 0; index < entity.relations.length; index += 1) {
        const current = entity.relations[index];
        const member = relation(index, variant);
        if (current !== undefined && member !== null) {
          relations.push(relationLine(current.name, member));
        }
      }
    }

    if (variant === 'update') {
      const base = `Partial<{\n${own.join('\n')}\n}>`;
      return relations.length === 0
        ? `export type ${name} = ${base};`
        : `export type ${name} = ${base} & {\n${relations.join('\n')}\n};`;
    }
    return typeBlock(name, [...own, ...relations]);
  }

  function renderWhere(name: string, family: FamilyName): string {
    const members: string[] = [];
    for (const field of entity.fields) {
      const filter = filterClass(field);
      if (filter === null) continue;
      usedFilters.add(filter);
      members.push(`  ${field.name}?: ${filter};`);
    }
    if (family === 'deep') {
      for (let index = 0; index < entity.relations.length; index += 1) {
        const current = entity.relations[index];
        const member = relation(index, 'where');
        if (current !== undefined && member !== null) {
          members.push(relationLine(current.name, member));
        }
      }
    }
    members.push(
      `  AND?: ${name} | ${name}[];`,
      `  OR?: ${name} | ${name}[];`,
      `  NOT?: ${name} | ${name}[];`,
    );
    return typeBlock(name, members);
  }

  function renderSelect(name: string, family: FamilyName): string {
    const members = entity.fields.map((field) => `  ${field.name}?: boolean;`);
    for (let index = 0; index < entity.relations.length; index += 1) {
      const current = entity.relations[index];
      if (current === undefined) continue;
      if (family === 'flat') {
        members.push(`  ${current.name}?: boolean;`);
        continue;
      }
      const member = relation(index, 'select');
      members.push(
        member === null
          ? `  ${current.name}?: boolean;`
          : relationLine(current.name, member),
      );
    }
    return typeBlock(name, members);
  }
}
