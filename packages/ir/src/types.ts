/**
 * Type surface of the IR. Every alias is `v.InferOutput<typeof …Schema>` — the
 * schemas in `schemas.ts` are the single source of truth, there is no
 * hand-written interface here.
 */
import type * as v from 'valibot';
import type {
  CompositeUniqueSchema,
  ConstraintsSchema,
  DefaultValueSchema,
  EntitySchema,
  EnumDefSchema,
  EnumValueSchema,
  FieldSchema,
  FieldTypeSchema,
  IndexDefSchema,
  IndexTypeSchema,
  IrSchema,
  ReferentialActionSchema,
  RelationSchema,
  RelationTargetSchema,
  ScalarTypeSchema,
  SourceIrSchema,
  StringFormatSchema,
} from './schemas.js';

export type { JsonValue } from './schemas.js';

export type IR = v.InferOutput<typeof IrSchema>;
export type SourceIR = v.InferOutput<typeof SourceIrSchema>;
export type Entity = v.InferOutput<typeof EntitySchema>;
export type Field = v.InferOutput<typeof FieldSchema>;
export type FieldType = v.InferOutput<typeof FieldTypeSchema>;
export type ScalarType = v.InferOutput<typeof ScalarTypeSchema>;
export type StringFormat = v.InferOutput<typeof StringFormatSchema>;
export type ReferentialAction = v.InferOutput<typeof ReferentialActionSchema>;
export type IndexType = v.InferOutput<typeof IndexTypeSchema>;
export type Constraints = v.InferOutput<typeof ConstraintsSchema>;
export type DefaultValue = v.InferOutput<typeof DefaultValueSchema>;
export type Relation = v.InferOutput<typeof RelationSchema>;
export type RelationTarget = v.InferOutput<typeof RelationTargetSchema>;
export type EnumDef = v.InferOutput<typeof EnumDefSchema>;
export type EnumValue = v.InferOutput<typeof EnumValueSchema>;
export type IndexDef = v.InferOutput<typeof IndexDefSchema>;
export type CompositeUnique = v.InferOutput<typeof CompositeUniqueSchema>;
