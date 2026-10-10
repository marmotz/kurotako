/** Shared payload field selection and Where-filter classification. */
import type { DateType, Entity, Field } from '@kurotako/ir';
import {
  createFields,
  isCreateOptional,
  isReadOptional,
  readFields,
  temporalClass,
  updateFields,
} from '@kurotako/ir';
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
    case 'read':
      return readFields(entity).map((field) => ({
        field,
        optional: isReadOptional(field),
      }));
    case 'where':
    case 'select':
      return entity.fields.map((field) => ({ field, optional: true }));
  }
}

/**
 * The Where filter type for a direct scalar or enum field. Date-like fields share
 * `DateTimeFilter`, except under `dateType: 'temporal'` where each Temporal class
 * has its own (`InstantFilter`, `PlainDateFilter`, `PlainTimeFilter`).
 */
export function filterClass(
  field: Field,
  dateType: DateType = 'date',
): string | null {
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
      return dateType === 'temporal'
        ? `${temporalClass(field.type.scalar, field.constraints.format)}Filter`
        : 'DateTimeFilter';
    case 'json':
      return null;
  }
}
