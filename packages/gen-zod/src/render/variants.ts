/**
 * Per-entity field-set derivation for the five variants.
 *
 * The `create` / `update` field selection and create-optionality come from
 * `@kurotako/ir`'s shared-decision helpers (`createFields`, `isCreateOptional`,
 * `updateFields`) — never re-encoded here — so `generator-angular`'s control tree
 * and this schema stay in lockstep. This module only maps the resulting lists to
 * the Zod-specific projections.
 */
import type { Entity, Field } from '@kurotako/ir';
import { createFields, isCreateOptional, updateFields } from '@kurotako/ir';
import { enumFilterName, type VariantName } from '../names.js';

export interface FieldSelection {
  field: Field;
  /** Whether the field is optional in this variant. */
  optional: boolean;
}

/** `update` is emitted as a whole-object `.partial()`; `where` wraps its entries. */
export function isPartialVariant(variant: VariantName): boolean {
  return variant === 'update';
}

/** The scalar/enum field set for a variant, with per-field optionality. */
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

/**
 * The Where operator schema identifier for a field, or `null` when the field's
 * scalar class has no filter (`json`, `unknown`).
 */
export function filterClass(field: Field): string | null {
  const type = field.type;
  if (type.kind === 'enum') {
    return enumFilterName(type.ref);
  }
  if (type.kind !== 'scalar') {
    return null;
  }
  switch (type.scalar) {
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
