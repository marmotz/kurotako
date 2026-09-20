/**
 * `relations: 'deep'` relation selection: a to-one relation becomes a nested
 * object, a to-many relation an array. Cross-source relations degrade to the flat
 * FK scalar (the relation object is absent from the Zod deep DTO) with a `debug`
 * log, consistent with `gen-zod`'s deep family. TanStack Form addresses nested
 * values natively by path (`'author.name'`, `'tags[0].name'`), so nothing else is
 * needed at runtime.
 */
import type { Logger } from '@kurotako/core';
import type { Entity, Relation } from '@kurotako/ir';
import { isCrossSource } from '@kurotako/ir';

export interface DeepRelation {
  relation: Relation;
  many: boolean;
}

/** Every non-cross-source relation on `entity`; cross-source ones are skipped and logged. */
export function deepRelations(
  entity: Entity,
  namespace: string,
  logger?: Logger,
): DeepRelation[] {
  const out: DeepRelation[] = [];
  for (const relation of entity.relations) {
    if (isCrossSource(namespace, relation)) {
      logger?.debug(
        `gen-react-tanstack: relation '${relation.name}' targets another source ('${relation.target.namespace}.${relation.target.entity}'); degrading to the flat FK scalar in deep mode`,
      );
      continue;
    }
    out.push({ relation, many: relation.cardinality === 'many' });
  }
  return out;
}
