/** Field types -> bare TypeScript type strings and their emitted dependencies. */
import type { Entity, Field, FieldType, SourceIR } from '@kurotako/ir';
import { flattenUnion, resolveEnum, scalarTsType } from '@kurotako/ir';
import { typeName } from '../names.js';

export interface TypeDependencies {
  enums: Set<string>;
  entityRefs: Set<string>;
  aliases: Set<string>;
  usesJsonValue: boolean;
}

function emptyDependencies(): TypeDependencies {
  return {
    enums: new Set(),
    entityRefs: new Set(),
    aliases: new Set(),
    usesJsonValue: false,
  };
}

/** Collect imports required by a field type, including refs nested in unions. */
export function collectTypeDependencies(
  type: FieldType,
  source: SourceIR,
  entity: Entity | undefined,
  into: TypeDependencies = emptyDependencies(),
): TypeDependencies {
  switch (type.kind) {
    case 'enum': {
      const definition = resolveEnum(source, entity, type.ref);
      into.enums.add(definition?.name ?? type.ref);
      break;
    }
    case 'ref':
      if (source.entities[type.ref] !== undefined) {
        into.entityRefs.add(type.ref);
      } else if (source.typeAliases?.[type.ref] !== undefined) {
        into.aliases.add(type.ref);
      }
      break;
    case 'scalar':
      if (scalarTsType(type) === 'JsonValue') {
        into.usesJsonValue = true;
      }
      break;
    case 'union':
      for (const variant of type.variants) {
        collectTypeDependencies(variant, source, entity, into);
      }
      break;
    case 'map':
      collectTypeDependencies(type.value, source, entity, into);
      break;
    case 'unknown':
      break;
  }
  return into;
}

/**
 * Render a `FieldType` recursively. Entity refs name their emitted flat DTO;
 * type-alias refs retain their declared name from the source alias registry.
 */
export function renderFieldType(type: FieldType, source: SourceIR): string {
  switch (type.kind) {
    case 'ref':
      return source.entities[type.ref] !== undefined
        ? typeName(type.ref)
        : type.ref;
    case 'union': {
      const variants = flattenUnion(type);
      return variants.length === 0
        ? 'unknown'
        : variants
            .map((variant) =>
              variant.kind === 'union'
                ? `(${renderFieldType(variant, source)})`
                : renderFieldType(variant, source),
            )
            .join(' | ');
    }
    case 'map':
      return `Record<string, ${renderFieldType(type.value, source)}>`;
    case 'scalar':
    case 'enum':
    case 'unknown':
      return scalarTsType(type);
  }
}

/** The non-list, non-nullable type for a field. */
export function fieldTsType(
  field: Field,
  source: SourceIR,
  entity: Entity,
): string {
  collectTypeDependencies(field.type, source, entity);
  return renderFieldType(field.type, source);
}
