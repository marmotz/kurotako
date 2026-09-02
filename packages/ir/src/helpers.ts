/**
 * Traversal / resolution helpers. All pure, none throw — they return `undefined`
 * on a miss. `resolveEnum` implements the entity-local → source-level precedence
 * in one place so every generator agrees.
 */
import type {
  Entity,
  EnumDef,
  Field,
  FieldType,
  IR,
  Relation,
  ScalarType,
  SourceIR,
} from './types.js';

export function getSource(ir: IR, namespace: string): SourceIR | undefined {
  return ir.sources[namespace];
}

export function resolveEntity(
  ir: IR,
  namespace: string,
  name: string,
): Entity | undefined {
  return ir.sources[namespace]?.entities[name];
}

/** Entity-local enums shadow source-level enums of the same name. */
export function resolveEnum(
  source: SourceIR,
  entity: Entity | undefined,
  ref: string,
): EnumDef | undefined {
  return entity?.enums?.[ref] ?? source.enums[ref];
}

/**
 * A relation is cross-source when its target namespace is anything other than
 * the entity's own namespace — including the "absent" (empty) namespace, which
 * v1 drivers treat as an unresolved cross-source reference.
 */
export function isCrossSource(fromNamespace: string, rel: Relation): boolean {
  return rel.target.namespace !== fromNamespace;
}

/**
 * Resolve the target entity of a relation. Returns `undefined` when the target
 * namespace is absent or not present in the IR, or when the entity is missing.
 */
export function resolveRelationTarget(
  ir: IR,
  fromNamespace: string,
  rel: Relation,
): Entity | undefined {
  const ns = isCrossSource(fromNamespace, rel)
    ? rel.target.namespace
    : fromNamespace;
  return ir.sources[ns]?.entities[rel.target.entity];
}

export function* iterEntities(
  ir: IR,
): Iterable<{ namespace: string; entity: Entity }> {
  for (const [namespace, source] of Object.entries(ir.sources)) {
    for (const entity of Object.values(source.entities)) {
      yield { namespace, entity };
    }
  }
}

export function* iterFields(entity: Entity): Iterable<Field> {
  yield* entity.fields;
}

/** Fields named by `entity.primaryKey`, in declaration order. */
export function primaryKeyFields(entity: Entity): Field[] {
  const pk = entity.primaryKey;
  if (pk === undefined) {
    return [];
  }
  const byName = new Map(entity.fields.map((f) => [f.name, f]));
  const out: Field[] = [];
  for (const name of pk) {
    const field = byName.get(name);
    if (field !== undefined) {
      out.push(field);
    }
  }
  return out;
}

// --- shared-decision helpers ------------------------------------------------
//
// Principle: any modelling rule that a parser or a generator would otherwise
// re-implement "in its own way" lives here as a pure helper, so the whole
// pipeline reads it from one place. `generator-zod` (#34) and `generator-angular`
// (#39) MUST consume these rather than re-encode the create/update payload-shape
// rules or the scalar -> TS type mapping.

/** Closed set of scalar TS type tokens `scalarTsType` may return for a scalar. */
export type ScalarTsType =
  | 'string'
  | 'number'
  | 'bigint'
  | 'boolean'
  | 'Date'
  | 'Uint8Array'
  | 'JsonValue'
  | 'unknown';

/**
 * The value is assigned by the DB/server (an `expr` default: `now()`,
 * `autoincrement()`, `uuid()`, `dbgenerated("…")`, …) and is never supplied on a
 * create payload.
 */
export function isDbAssigned(field: Field): boolean {
  return field.default?.kind === 'expr';
}

/**
 * Fields to include in a "create" payload: `entity.fields` minus the ones whose
 * only value source is db-side (a primary-key member that is `isDbAssigned`).
 */
export function createFields(entity: Entity): Field[] {
  const pk = new Set(entity.primaryKey ?? []);
  return entity.fields.filter(
    (field) => !(pk.has(field.name) && isDbAssigned(field)),
  );
}

/**
 * A create-payload field the caller may omit:
 * `field.optional || field.default != null || isDbAssigned(field)`.
 */
export function isCreateOptional(field: Field): boolean {
  return field.optional || field.default !== undefined || isDbAssigned(field);
}

/**
 * Fields to include in an "update" payload: `entity.fields` minus primary-key
 * members; the caller treats every one as optional (partial).
 */
export function updateFields(entity: Entity): Field[] {
  const pk = new Set(entity.primaryKey ?? []);
  return entity.fields.filter((field) => !pk.has(field.name));
}

/**
 * The TS type a non-nullable, non-list value of this field maps to, as a source
 * string every generator's typed output must agree on. Returns a `ScalarTsType`
 * token for scalars (`bytes -> 'Uint8Array'`, `json -> 'JsonValue'`, `decimal`
 * kept as `'string'` to preserve precision — runtime representation stays each
 * generator's choice), the enum type name for `{ kind: 'enum' }` (identifiers are
 * never prefixed, ADR-0004), and `'unknown'` for `{ kind: 'unknown' }`.
 */
export function scalarTsType(type: FieldType): string {
  switch (type.kind) {
    case 'enum':
      return type.ref;
    case 'unknown':
      return 'unknown';
    case 'scalar':
      return mapScalar(type.scalar);
  }
}

function mapScalar(scalar: ScalarType): ScalarTsType {
  switch (scalar) {
    case 'string':
    case 'uuid':
    case 'decimal':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'int':
    case 'float':
      return 'number';
    case 'bigint':
      return 'bigint';
    case 'date':
    case 'datetime':
      return 'Date';
    case 'bytes':
      return 'Uint8Array';
    case 'json':
      return 'JsonValue';
  }
}
