/** Shared payload field selection and Where-filter classification. */
import type { Entity, Field } from '@kurotako/ir';
import { createFields, isCreateOptional, updateFields } from '@kurotako/ir';
import type { VariantName } from '../names.js';

export interface FieldSelection {
  field: Field;
  optional: boolean;
}

/** The scalar/enum fields included by a generated type variant. */
export function variantFields(
  entity: Entity,
  variant: VariantName,
): FieldSelection[] {
  switch (variant) {
    case 'full':
      return entity.fields.map((field) => ({
        field,
        optional: field.optional,
      }));
    case 'create':
      return createFields(entity).map((field) => ({
        field,
        optional: isCreateOptional(field),
      }));
    case 'update':
      return updateFields(entity).map((field) => ({ field, optional: true }));
    case 'where':
    case 'select':
      return entity.fields.map((field) => ({ field, optional: true }));
  }
}

/** The Where filter type for a direct scalar or enum field. */
export function filterClass(field: Field): string | null {
  if (field.type.kind === 'enum') return `Enum${field.type.ref}Filter`;
  if (field.type.kind !== 'scalar') return null;

  switch (field.type.scalar) {
    case 'string':
    case 'uuid':
    case 'decimal':
    case 'bytes':
      return 'StringFilter';
    case 'int':
      return 'IntFilter';
    case 'float':
      return 'FloatFilter';
    case 'bigint':
      return 'BigIntFilter';
    case 'boolean':
      return 'BoolFilter';
    case 'date':
    case 'datetime':
      return 'DateTimeFilter';
    case 'json':
      return null;
  }
}
