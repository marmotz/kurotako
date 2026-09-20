/**
 * Per-entity field-set derivation for the three hook variants.
 *
 * `create` / `update` come from `@kurotako/ir`'s shared-decision helpers
 * (`createFields`, `updateFields`), the same ones `gen-zod` calls, so the default
 * values and the Zod schema a hook validates against agree by construction.
 */
import type { Entity, Field } from '@kurotako/ir';
import { createFields, updateFields } from '@kurotako/ir';
import type { Variant } from '../names.js';

/** The scalar / enum field set of a variant, in IR declaration order. */
export function variantFields(entity: Entity, variant: Variant): Field[] {
  switch (variant) {
    case 'full':
      return entity.fields;
    case 'create':
      return createFields(entity);
    case 'update':
      return updateFields(entity);
  }
}
