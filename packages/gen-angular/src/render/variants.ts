/**
 * Per-entity field-set derivation for the two form variants.
 *
 * The `Create` / `Update` field selection comes from `@kurotako/ir`'s
 * shared-decision helpers (`createFields`, `updateFields`) — the same helpers
 * `gen-zod` calls — so the control tree and the Zod schema it delegates
 * validation to agree by construction, not by two implementations happening to
 * match (`generator-angular/technical.md` §Variant field sets).
 */
import type { Entity, Field } from '@kurotako/ir';
import { createFields, updateFields } from '@kurotako/ir';
import type { Variant } from '../names.js';

/** The scalar/enum field set for a form variant, in IR declaration order. */
export function variantFields(entity: Entity, variant: Variant): Field[] {
  return variant === 'Create' ? createFields(entity) : updateFields(entity);
}
