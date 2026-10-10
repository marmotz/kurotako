/** Field types -> bare TypeScript type strings and their emitted dependencies. */
import type {
  DateType,
  Entity,
  Field,
  FieldType,
  SourceIR,
  StringFormat,
} from '@kurotako/ir';
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
    case 'array':
      collectTypeDependencies(type.element, source, entity, into);
      break;
    case 'unknown':
      break;
  }
  return into;
}

/** How date-like scalars are typed; `format` is the owning field's `constraints.format`. */
export interface DateRenderOptions {
  dateType?: DateType;
  format?: StringFormat;
}

/**
 * Render a `FieldType` recursively. Entity refs name their emitted flat DTO;
 * type-alias refs retain their declared name from the source alias registry.
 * `dateOpts.format` only applies to a top-level scalar, nested types carry no
 * constraints of their own.
 */
export function renderFieldType(
  type: FieldType,
  source: SourceIR,
  dateOpts?: DateRenderOptions,
): string {
  const nested = dateOpts && { dateType: dateOpts.dateType };
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
                ? `(${renderFieldType(variant, source, nested)})`
                : renderFieldType(variant, source, nested),
            )
            .join(' | ');
    }
    case 'map':
      return `Record<string, ${renderFieldType(type.value, source, nested)}>`;
    case 'array':
      return type.element.kind === 'union'
        ? `(${renderFieldType(type.element, source, nested)})[]`
        : `${renderFieldType(type.element, source, nested)}[]`;
    case 'scalar':
    case 'enum':
    case 'unknown':
      return scalarTsType(type, dateOpts);
  }
}

/** The non-list, non-nullable type for a field. */
export function fieldTsType(
  field: Field,
  source: SourceIR,
  entity: Entity,
  dateType?: DateType,
): string {
  collectTypeDependencies(field.type, source, entity);
  return renderFieldType(field.type, source, {
    dateType,
    format: field.constraints.format,
  });
}
