/**
 * `PrismaModel` → `SourceIR`, driven entirely by the `createSourceIR` fluent
 * builder (the parser never hand-assembles IR).
 *
 * Field rules: `list ← isList`, `nullable ← !isRequired`,
 * `optional ← hasDefaultValue || isUpdatedAt`, `unique ← isUnique`. Scalars and
 * native-type refinement come from `map/scalars.ts`, defaults / id `format` from
 * `map/defaults.ts`, relations and implicit-m2m materialisation from
 * `map/relations.ts` (this module injects the namespace into every relation
 * target). Enums are emitted at source level, matching Prisma.
 */
import type { Logger } from '@kurotako/core';
import type { IndexType } from '@kurotako/ir';
import {
  createSourceIR,
  type EntityBuilder,
  type EnumBuilder,
  type FieldBuilder,
  type Relation,
  type SourceIR,
} from '@kurotako/ir';
import type { PrismaEnum, PrismaModel } from '../dmmf/model.js';
import { mapDefault } from './defaults.js';
import { buildRelations } from './relations.js';
import { mapFieldType } from './scalars.js';

const INDEX_TYPES = new Set<IndexType>([
  'btree',
  'hash',
  'gin',
  'gist',
  'brin',
  'spgist',
]);

function asIndexType(raw: string | undefined): IndexType | undefined {
  return raw !== undefined && INDEX_TYPES.has(raw as IndexType)
    ? (raw as IndexType)
    : undefined;
}

function fillEnum(eb: EnumBuilder, e: PrismaEnum): void {
  for (const value of e.values) {
    const opts: { dbName?: string; doc?: string } = {};
    if (value.dbName !== undefined) {
      opts.dbName = value.dbName;
    }
    if (value.doc !== undefined) {
      opts.doc = value.doc;
    }
    eb.value(value.name, opts);
  }
  if (e.doc !== undefined) {
    eb.doc(e.doc);
  }
  if (e.dbName !== undefined) {
    eb.dbName(e.dbName);
  }
}

function addRelation(
  eb: EntityBuilder,
  rel: Relation,
  namespace: string,
): void {
  eb.relation(rel.name, (rb) => {
    rb.to(namespace, rel.target.entity);
    if (rel.cardinality === 'many') {
      rb.many();
    } else {
      rb.one();
    }
    if (rel.optional) {
      rb.optional();
    }
    if (rel.owning) {
      rb.owning();
    }
    if (rel.backRelation !== undefined) {
      rb.backRelation(rel.backRelation);
    }
    if (rel.fkFields) {
      rb.fkFields(...rel.fkFields);
    }
    if (rel.references) {
      rb.references(...rel.references);
    }
    if (rel.onDelete) {
      rb.onDelete(rel.onDelete);
    }
    if (rel.onUpdate) {
      rb.onUpdate(rel.onUpdate);
    }
  });
}

export function buildSourceIR(
  namespace: string,
  model: PrismaModel,
  parserVersion: string,
  logger?: Logger,
): SourceIR {
  const b = createSourceIR({ namespace, parser: 'prisma', parserVersion });

  for (const e of model.enums) {
    b.addEnum(e.name, (eb) => fillEnum(eb, e));
  }

  const { relations, syntheticEntities } = buildRelations(model, logger);

  for (const entity of model.entities) {
    b.addEntity(entity.name, (eb) => {
      for (const field of entity.fields) {
        eb.field(field.name, (fb: FieldBuilder) => {
          const mapped = mapFieldType(field, logger);
          const scalar =
            mapped.scalarOverride ??
            (mapped.type.kind === 'scalar' ? mapped.type.scalar : undefined);

          if (scalar !== undefined) {
            fb.scalar(scalar);
          } else if (mapped.type.kind === 'enum') {
            fb.enum(mapped.type.ref);
          } else {
            fb.unknown(
              mapped.type.kind === 'unknown' ? mapped.type.hint : undefined,
            );
          }

          const isString = scalar === 'string';
          const { maxLength, format: nativeFormat } = mapped.constraints;
          if (maxLength !== undefined) {
            fb.maxLength(maxLength);
          }

          const mappedDefault = mapDefault(field.default);
          if (mappedDefault.default) {
            fb.default(mappedDefault.default);
          }
          const format = mappedDefault.format ?? nativeFormat;
          if (format !== undefined) {
            if (isString) {
              fb.format(format);
            } else {
              logger?.debug(
                `prisma parser: dropping format '${format}' on non-string field '${entity.name}.${field.name}'`,
              );
            }
          }

          if (field.isList) {
            fb.list();
          }
          if (!field.isRequired) {
            fb.nullable();
          }
          if (field.hasDefaultValue || field.isUpdatedAt) {
            fb.optional();
          }
          if (field.isUnique) {
            fb.unique();
          }
          if (field.doc !== undefined) {
            fb.doc(field.doc);
          }
        });
      }

      if (entity.primaryKey.length > 0) {
        eb.primaryKey(...entity.primaryKey);
      }
      for (const unique of entity.uniques) {
        eb.unique(
          unique.fields,
          unique.name ? { name: unique.name } : undefined,
        );
      }
      for (const index of entity.indexes) {
        const opts: { name?: string; type?: IndexType } = {};
        if (index.name) {
          opts.name = index.name;
        }
        const type = asIndexType(index.type);
        if (type) {
          opts.type = type;
        }
        eb.index(index.fields, opts);
      }
      if (entity.doc !== undefined) {
        eb.doc(entity.doc);
      }
      if (entity.dbName !== undefined) {
        eb.dbName(entity.dbName);
      }
      for (const rel of relations.get(entity.name) ?? []) {
        addRelation(eb, rel, namespace);
      }
    });
  }

  for (const synthetic of syntheticEntities) {
    b.addEntity(synthetic.name, (eb) => {
      for (const field of synthetic.fields) {
        eb.field(field.name, (fb) => fb.scalar(field.scalar));
      }
      eb.primaryKey(...synthetic.primaryKey);
      for (const rel of synthetic.relations) {
        addRelation(eb, rel, namespace);
      }
    });
  }

  return b.build();
}
