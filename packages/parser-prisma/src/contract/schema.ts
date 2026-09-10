import * as v from 'valibot';
import { PrismaContractError } from '../errors.js';

const scalarType = v.looseObject({
  kind: v.literal('scalar'),
  codecId: v.string(),
  typeParams: v.optional(v.looseObject({ length: v.optional(v.number()) })),
});

const valueObjectType = v.looseObject({
  kind: v.literal('valueObject'),
  name: v.string(),
});

const field = v.looseObject({
  nullable: v.boolean(),
  many: v.optional(v.boolean()),
  type: v.union([scalarType, valueObjectType]),
  valueSet: v.optional(v.looseObject({ entityName: v.string() })),
});

const relation = v.looseObject({
  cardinality: v.picklist(['1:1', '1:N', 'N:1', 'N:M']),
  to: v.looseObject({ namespace: v.string(), model: v.string() }),
  on: v.looseObject({
    localFields: v.array(v.string()),
    targetFields: v.array(v.string()),
  }),
});

const model = v.looseObject({
  fields: v.record(v.string(), field),
  relations: v.optional(v.record(v.string(), relation)),
  storage: v.looseObject({
    table: v.string(),
    namespaceId: v.string(),
    fields: v.record(v.string(), v.looseObject({ column: v.string() })),
  }),
});

const enumDef = v.looseObject({
  members: v.array(v.looseObject({ name: v.string(), value: v.string() })),
});

const column = v.looseObject({
  codecId: v.string(),
  nullable: v.boolean(),
  many: v.optional(v.boolean()),
  default: v.optional(
    v.looseObject({
      kind: v.picklist(['function', 'literal']),
      expression: v.optional(v.string()),
      value: v.optional(
        v.union([
          v.string(),
          v.number(),
          v.boolean(),
          v.array(v.union([v.string(), v.number(), v.boolean()])),
        ]),
      ),
    }),
  ),
});

const table = v.looseObject({
  columns: v.record(v.string(), column),
  primaryKey: v.optional(v.looseObject({ columns: v.array(v.string()) })),
  uniques: v.optional(
    v.array(
      v.looseObject({
        columns: v.array(v.string()),
        name: v.optional(v.string()),
      }),
    ),
  ),
  indexes: v.optional(
    v.array(
      v.looseObject({
        columns: v.array(v.string()),
        name: v.optional(v.string()),
        type: v.optional(v.string()),
      }),
    ),
  ),
  foreignKeys: v.optional(
    v.array(
      v.looseObject({
        source: v.looseObject({ columns: v.array(v.string()) }),
        onDelete: v.optional(v.string()),
        onUpdate: v.optional(v.string()),
      }),
    ),
  ),
});

export const ContractSchema = v.looseObject({
  schemaVersion: v.string(),
  target: v.string(),
  targetFamily: v.string(),
  domain: v.looseObject({
    namespaces: v.record(
      v.string(),
      v.looseObject({
        models: v.record(v.string(), model),
        enum: v.optional(v.record(v.string(), enumDef)),
      }),
    ),
  }),
  storage: v.looseObject({
    namespaces: v.record(
      v.string(),
      v.looseObject({
        entries: v.looseObject({
          table: v.optional(v.record(v.string(), table)),
          valueSet: v.optional(
            v.record(
              v.string(),
              v.looseObject({ values: v.array(v.string()) }),
            ),
          ),
        }),
      }),
    ),
  }),
  execution: v.optional(
    v.looseObject({
      mutations: v.optional(
        v.looseObject({
          defaults: v.optional(
            v.array(
              v.looseObject({
                ref: v.looseObject({
                  namespace: v.string(),
                  table: v.string(),
                  column: v.string(),
                }),
                onCreate: v.optional(
                  v.looseObject({ kind: v.string(), id: v.string() }),
                ),
                onUpdate: v.optional(
                  v.looseObject({ kind: v.string(), id: v.string() }),
                ),
              }),
            ),
          ),
        }),
      ),
    }),
  ),
});

export type Contract = v.InferOutput<typeof ContractSchema>;

function issuePath(err: unknown): string {
  if (err instanceof v.ValiError) {
    return err.issues
      .map(
        (issue) =>
          issue.path
            ?.map((part: { key: unknown }) => String(part.key))
            .join('.') ?? '<root>',
      )
      .join(', ');
  }
  return '<root>';
}

export function parseContract(raw: string): Contract {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    throw new PrismaContractError('invalid JSON', { cause: err });
  }
  try {
    return v.parse(ContractSchema, value);
  } catch (err) {
    throw new PrismaContractError(`invalid structure at ${issuePath(err)}`, {
      cause: err,
    });
  }
}
