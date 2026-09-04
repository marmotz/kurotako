/**
 * `relations: 'deep'` control-tree entries: nested `FormGroup` for a to-one
 * relation, `FormArray` for a to-many one. `relations: 'flat'` (default) emits
 * nothing for relation objects — the caller simply never calls this module
 * (`generator-angular/technical.md` §Relations).
 *
 * Cross-source relations always degrade to flat (FK scalar only) + a `debug`
 * log, consistent with `gen-zod`'s deep family.
 */
import type { Logger } from '@kurotako/core';
import type { Entity, Relation } from '@kurotako/ir';
import { isCrossSource } from '@kurotako/ir';
import type { Variant } from '../names.js';
import {
  controlsTypeName,
  formTypeName,
  relationBuilderMethod,
} from '../names.js';
import type { ControlEntry } from './controls.js';

export interface DeepRelation {
  relation: Relation;
  many: boolean;
  /** The `ControlEntry` this relation contributes to the deep control-tree interface. */
  entry: ControlEntry;
  /** `<Target><Variant>DeepForm` — the target's `FormGroup<...>` type alias. */
  targetFormType: string;
  /** `add<Relation><Variant>` — the builder method name on the reactive factory. */
  builderMethod: string;
}

/**
 * Every non-cross-source relation on `entity`, rendered as a deep control-tree
 * entry. Cross-source relations are skipped (flat degrade) and logged.
 */
export function deepRelations(
  entity: Entity,
  variant: Variant,
  namespace: string,
  logger?: Logger,
): DeepRelation[] {
  const out: DeepRelation[] = [];
  for (const relation of entity.relations) {
    if (isCrossSource(namespace, relation)) {
      logger?.debug(
        `gen-angular: relation '${relation.name}' targets another source ('${relation.target.namespace}.${relation.target.entity}'); degrading to the flat FK scalar in deep mode`,
      );
      continue;
    }

    const many = relation.cardinality === 'many';
    const targetControls = controlsTypeName(
      relation.target.entity,
      variant,
      'Deep',
    );
    const targetFormType = formTypeName(
      relation.target.entity,
      variant,
      'Deep',
    );
    const groupType = `FormGroup<${targetControls}>`;
    const fullType = many ? `FormArray<${groupType}>` : groupType;

    out.push({
      relation,
      many,
      entry: { name: relation.name, fullType },
      targetFormType,
      builderMethod: relationBuilderMethod(relation.name, variant),
    });
  }
  return out;
}
