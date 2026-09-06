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
  IndexDefSchema,
  IndexTypeSchema,
  IrSchema,
  ReferentialActionSchema,
  RelationSchema,
  RelationTargetSchema,
  ScalarTypeSchema,
  SourceIrSchema,
  StringFormatSchema,
  TypeAliasSchema,
} from './schemas.js';

export type { JsonValue } from './schemas.js';

/**
 * Hand-written because `FieldTypeSchema` is recursive (`union` variant) and
 * `v.lazy` needs an explicit type — same pattern as `JsonValue`.
 * `ref` is a bare name resolved against the same source (`entities` then
 * `typeAliases`); there is no namespace qualifier in v1.
 */
export type FieldType =
  | { kind: 'scalar'; scalar: ScalarType }
  | { kind: 'enum'; ref: string }
  | { kind: 'unknown'; hint?: string }
  | { kind: 'ref'; ref: string }
  | {
      kind: 'union';
      variants: FieldType[];
      discriminator?: {
        propertyName: string;
        mapping?: Record<string, string>;
      };
    };

export type IR = v.InferOutput<typeof IrSchema>;
export type SourceIR = v.InferOutput<typeof SourceIrSchema>;
export type Entity = v.InferOutput<typeof EntitySchema>;
export type Field = v.InferOutput<typeof FieldSchema>;
export type ScalarType = v.InferOutput<typeof ScalarTypeSchema>;
export type TypeAlias = v.InferOutput<typeof TypeAliasSchema>;
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
