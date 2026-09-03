/**
 * `PrismaModel` — the mode-neutral shape `map/build.ts` consumes.
 *
 * It is deliberately free of any `@prisma/*` type: `dmmf/read.ts` produces it
 * from the DMMF today, and the deferred Prisma 8 `contract.json` reader is meant
 * to produce the same shape without touching the mapping layer. Plain records,
 * no classes, no `Date`/`RegExp`.
 */

/** A Prisma default: a literal, a literal array, or a function call. */
export type PrismaDefault =
  | string
  | number
  | boolean
  | Array<string | number | boolean>
  | { name: string; args: Array<string | number> };

export interface PrismaField {
  name: string;
  /** Prisma scalar name (`String`, `Int`, …), enum name, or `Unsupported` raw. */
  type: string;
  kind: 'scalar' | 'enum' | 'unsupported';
  isList: boolean;
  isRequired: boolean;
  isUnique: boolean;
  isUpdatedAt: boolean;
  hasDefaultValue: boolean;
  /** `@db.VarChar(120)` → `['VarChar', ['120']]`; `@db.Uuid` → `['Uuid', []]`. */
  nativeType: [string, string[]] | null;
  default?: PrismaDefault;
  doc?: string;
}

export interface PrismaRelationEdge {
  /** The relation field name on the owning entity. */
  fieldName: string;
  relationName: string;
  targetEntity: string;
  isList: boolean;
  isRequired: boolean;
  fromFields: string[];
  toFields: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface PrismaUnique {
  fields: string[];
  name?: string;
}

export interface PrismaIndex {
  fields: string[];
  name?: string;
  type?: string;
}

export interface PrismaEntity {
  name: string;
  dbName?: string;
  doc?: string;
  fields: PrismaField[];
  relationEdges: PrismaRelationEdge[];
  primaryKey: string[];
  uniques: PrismaUnique[];
  indexes: PrismaIndex[];
}

export interface PrismaEnumValue {
  name: string;
  dbName?: string;
  doc?: string;
}

export interface PrismaEnum {
  name: string;
  dbName?: string;
  doc?: string;
  values: PrismaEnumValue[];
}

export interface PrismaModel {
  entities: PrismaEntity[];
  enums: PrismaEnum[];
}
