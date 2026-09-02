/**
 * Valibot schemas — the single source of truth for the IR format.
 *
 * `types.ts` derives every type alias from these schemas via `v.InferOutput`;
 * `validate.ts` runs `v.safeParse` against them before the cross-reference pass.
 * Every schema stays plain and JSON-serializable by construction: only object,
 * array, record, picklist, variant and primitives — no `Date`, `RegExp`, classes
 * or functions. This is what keeps `--emit-ir` and `parseIR` trivial.
 */
import * as v from 'valibot';

/** Recursive JSON value. Hand-written because `v.lazy` needs an explicit type. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export const JsonValueSchema: v.GenericSchema<JsonValue> = v.lazy(() =>
  v.union([
    v.null(),
    v.boolean(),
    v.number(),
    v.string(),
    v.array(JsonValueSchema),
    v.record(v.string(), JsonValueSchema),
  ]),
);

// --- closed unions -----------------------------------------------------------

export const ScalarTypeSchema = v.picklist([
  'string',
  'boolean',
  'int',
  'bigint',
  'float',
  'decimal',
  'date',
  'datetime',
  'uuid',
  'bytes',
  'json',
]);

export const StringFormatSchema = v.picklist([
  'email',
  'url',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'datetime',
  'date',
  'time',
  'duration',
  'ipv4',
  'ipv6',
]);

export const ReferentialActionSchema = v.picklist([
  'cascade',
  'restrict',
  'setNull',
  'setDefault',
  'noAction',
]);

export const IndexTypeSchema = v.picklist([
  'btree',
  'hash',
  'gin',
  'gist',
  'brin',
  'spgist',
]);

// --- field types -----------------------------------------------------------

export const FieldTypeSchema = v.variant('kind', [
  v.object({ kind: v.literal('scalar'), scalar: ScalarTypeSchema }),
  v.object({ kind: v.literal('enum'), ref: v.string() }),
  v.object({ kind: v.literal('unknown'), hint: v.optional(v.string()) }),
]);

export const ConstraintsSchema = v.object({
  min: v.optional(v.number()),
  max: v.optional(v.number()),
  minLength: v.optional(v.number()),
  maxLength: v.optional(v.number()),
  regex: v.optional(v.string()),
  format: v.optional(StringFormatSchema),
  unique: v.optional(v.boolean()),
});

export const DefaultValueSchema = v.variant('kind', [
  v.object({ kind: v.literal('value'), value: JsonValueSchema }),
  v.object({
    kind: v.literal('expr'),
    expr: v.string(),
    args: v.optional(v.array(JsonValueSchema)),
  }),
]);

export const FieldSchema = v.object({
  name: v.string(),
  type: FieldTypeSchema,
  list: v.boolean(),
  optional: v.boolean(),
  nullable: v.boolean(),
  constraints: ConstraintsSchema,
  default: v.optional(DefaultValueSchema),
  doc: v.optional(v.string()),
  dbName: v.optional(v.string()),
});

// --- relations -----------------------------------------------------------

export const RelationTargetSchema = v.object({
  namespace: v.string(),
  entity: v.string(),
});

export const RelationSchema = v.object({
  name: v.string(),
  target: RelationTargetSchema,
  cardinality: v.picklist(['one', 'many']),
  optional: v.boolean(),
  owning: v.boolean(),
  backRelation: v.optional(v.string()),
  fkFields: v.optional(v.array(v.string())),
  references: v.optional(v.array(v.string())),
  onDelete: v.optional(ReferentialActionSchema),
  onUpdate: v.optional(ReferentialActionSchema),
});

// --- enums -----------------------------------------------------------

export const EnumValueSchema = v.object({
  name: v.string(),
  dbName: v.optional(v.string()),
  doc: v.optional(v.string()),
});

export const EnumDefSchema = v.object({
  name: v.string(),
  values: v.array(EnumValueSchema),
  doc: v.optional(v.string()),
  dbName: v.optional(v.string()),
});

// --- indexes -----------------------------------------------------------

export const IndexDefSchema = v.object({
  fields: v.array(v.string()),
  name: v.optional(v.string()),
  type: v.optional(IndexTypeSchema),
});

export const CompositeUniqueSchema = v.object({
  fields: v.array(v.string()),
  name: v.optional(v.string()),
});

// --- entities and roots -----------------------------------------------------------

export const EntitySchema = v.object({
  name: v.string(),
  fields: v.array(FieldSchema),
  relations: v.array(RelationSchema),
  enums: v.optional(v.record(v.string(), EnumDefSchema)),
  primaryKey: v.optional(v.array(v.string())),
  indexes: v.array(IndexDefSchema),
  uniques: v.array(CompositeUniqueSchema),
  doc: v.optional(v.string()),
  dbName: v.optional(v.string()),
});

export const SourceIrSchema = v.object({
  namespace: v.string(),
  parser: v.string(),
  parserVersion: v.optional(v.string()),
  entities: v.record(v.string(), EntitySchema),
  enums: v.record(v.string(), EnumDefSchema),
});

export const IrSchema = v.object({
  irVersion: v.string(),
  sources: v.record(v.string(), SourceIrSchema),
});
