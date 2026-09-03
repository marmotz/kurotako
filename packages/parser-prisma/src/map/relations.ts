/**
 * Relation pairing and implicit-many-to-many materialisation.
 *
 * DMMF relation edges are grouped by `relationName`. A normal pair yields one
 * `Relation` per side (owning side = the one carrying `fromFields`). An implicit
 * m2m (both sides list, neither side carries fields) is materialised as a
 * synthetic join entity so downstream generators only ever see explicit m2m:
 * the two originals are rewritten to `many` relations pointing at the synthetic
 * entity, which gets `<model>Id` FK fields, a composite PK and two owning `one`
 * relations back to the originals.
 *
 * Every produced `Relation` has `target.namespace === ''`; `build.ts` injects
 * the real namespace (relations are always same-namespace for one Prisma
 * schema).
 */
import type { Logger } from '@kurotako/core';
import type { ReferentialAction, Relation, ScalarType } from '@kurotako/ir';
import type {
  PrismaEntity,
  PrismaModel,
  PrismaRelationEdge,
} from '../dmmf/model.js';
import { mapFieldType } from './scalars.js';

export interface SyntheticField {
  name: string;
  scalar: ScalarType;
}

export interface SyntheticEntity {
  name: string;
  fields: SyntheticField[];
  primaryKey: string[];
  relations: Relation[];
}

export interface BuiltRelations {
  relations: Map<string, Relation[]>;
  syntheticEntities: SyntheticEntity[];
}

const ACTION_MAP: Record<string, ReferentialAction> = {
  Cascade: 'cascade',
  Restrict: 'restrict',
  SetNull: 'setNull',
  SetDefault: 'setDefault',
  NoAction: 'noAction',
};

function mapAction(raw: string | undefined): ReferentialAction | undefined {
  return raw === undefined ? undefined : ACTION_MAP[raw];
}

function lcfirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

interface OwnedEdge {
  owner: string;
  edge: PrismaRelationEdge;
}

function isImplicitM2M(edges: OwnedEdge[]): boolean {
  return (
    edges.length === 2 &&
    edges.every(
      ({ edge }) =>
        edge.isList &&
        edge.fromFields.length === 0 &&
        edge.toFields.length === 0,
    )
  );
}

function pkScalar(
  entities: Map<string, PrismaEntity>,
  entityName: string,
  logger: Logger | undefined,
): ScalarType {
  const entity = entities.get(entityName);
  if (entity && entity.primaryKey.length === 1) {
    const pkName = entity.primaryKey[0];
    const field = entity.fields.find((f) => f.name === pkName);
    if (field) {
      const mapped = mapFieldType(field);
      if (mapped.scalarOverride) {
        return mapped.scalarOverride;
      }
      if (mapped.type.kind === 'scalar') {
        return mapped.type.scalar;
      }
    }
  }
  logger?.debug(
    `prisma parser: could not resolve primary-key scalar of '${entityName}', defaulting to string`,
  );
  return 'string';
}

function normalRelation(
  edge: PrismaRelationEdge,
  back: PrismaRelationEdge | undefined,
): Relation {
  const owning = edge.fromFields.length > 0;
  const relation: Relation = {
    name: edge.fieldName,
    target: { namespace: '', entity: edge.targetEntity },
    cardinality: edge.isList ? 'many' : 'one',
    optional: !edge.isRequired,
    owning,
  };
  if (owning) {
    relation.fkFields = [...edge.fromFields];
    relation.references = [...edge.toFields];
  }
  if (back) {
    relation.backRelation = back.fieldName;
  }
  const onDelete = mapAction(edge.onDelete);
  if (onDelete) {
    relation.onDelete = onDelete;
  }
  const onUpdate = mapAction(edge.onUpdate);
  if (onUpdate) {
    relation.onUpdate = onUpdate;
  }
  return relation;
}

function materialiseM2M(
  a: OwnedEdge,
  b: OwnedEdge,
  relationName: string,
  entities: Map<string, PrismaEntity>,
  logger: Logger | undefined,
): {
  synthetic: SyntheticEntity;
  rewrites: Array<{ owner: string; relation: Relation }>;
} {
  const sorted = [a.owner, b.owner].sort((l, r) =>
    l < r ? -1 : l > r ? 1 : 0,
  );
  const x = sorted[0] ?? a.owner;
  const y = sorted[1] ?? b.owner;
  const defaultName = `${x}To${y}`;
  const name =
    relationName !== '' && relationName !== defaultName
      ? relationName
      : `${x}${y}`;

  const fkX = `${lcfirst(x)}Id`;
  const fkY = `${lcfirst(y)}Id`;
  const relX = lcfirst(x);
  const relY = lcfirst(y);
  const pkX = entities.get(x)?.primaryKey[0] ?? 'id';
  const pkY = entities.get(y)?.primaryKey[0] ?? 'id';

  const synthetic: SyntheticEntity = {
    name,
    fields: [
      { name: fkX, scalar: pkScalar(entities, x, logger) },
      { name: fkY, scalar: pkScalar(entities, y, logger) },
    ],
    primaryKey: [fkX, fkY],
    relations: [
      {
        name: relX,
        target: { namespace: '', entity: x },
        cardinality: 'one',
        optional: false,
        owning: true,
        fkFields: [fkX],
        references: [pkX],
        onDelete: 'cascade',
      },
      {
        name: relY,
        target: { namespace: '', entity: y },
        cardinality: 'one',
        optional: false,
        owning: true,
        fkFields: [fkY],
        references: [pkY],
        onDelete: 'cascade',
      },
    ],
  };

  const mkRewrite = (
    edge: OwnedEdge,
    backName: string,
  ): { owner: string; relation: Relation } => ({
    owner: edge.owner,
    relation: {
      name: edge.edge.fieldName,
      target: { namespace: '', entity: name },
      cardinality: 'many',
      optional: false,
      owning: false,
      backRelation: backName,
    },
  });

  return {
    synthetic,
    rewrites: [
      mkRewrite(a, a.owner === x ? relX : relY),
      mkRewrite(b, b.owner === x ? relX : relY),
    ],
  };
}

export function buildRelations(
  model: PrismaModel,
  logger?: Logger,
): BuiltRelations {
  const entities = new Map(model.entities.map((e) => [e.name, e]));
  const relations = new Map<string, Relation[]>();
  const syntheticEntities: SyntheticEntity[] = [];

  const push = (owner: string, relation: Relation): void => {
    const list = relations.get(owner) ?? [];
    list.push(relation);
    relations.set(owner, list);
  };

  const groups = new Map<string, OwnedEdge[]>();
  for (const entity of model.entities) {
    for (const edge of entity.relationEdges) {
      const list = groups.get(edge.relationName) ?? [];
      list.push({ owner: entity.name, edge });
      groups.set(edge.relationName, list);
    }
  }

  for (const [relationName, edges] of groups) {
    if (isImplicitM2M(edges)) {
      const [a, b] = edges as [OwnedEdge, OwnedEdge];
      const { synthetic, rewrites } = materialiseM2M(
        a,
        b,
        relationName,
        entities,
        logger,
      );
      syntheticEntities.push(synthetic);
      for (const { owner, relation } of rewrites) {
        push(owner, relation);
      }
      continue;
    }

    for (const { owner, edge } of edges) {
      const back = edges.find((e) => e.edge !== edge)?.edge;
      push(owner, normalRelation(edge, back));
    }
  }

  return { relations, syntheticEntities };
}
