/**
 * `DMMF.Document` → the mode-neutral `PrismaModel`.
 *
 * Pure and total: it never touches disk or Prisma. Object fields become
 * `relationEdges`; scalar / enum / unsupported fields become `fields`. Model and
 * enum `documentation` / `dbName` are carried verbatim. Non-unique `@@index`
 * entries come from `datamodel.indexes` when the resolved `@prisma/internals`
 * exposes them (6.x does), otherwise `indexes` stays empty.
 */
import type * as DMMF from '@prisma/dmmf';
import type {
  PrismaDefault,
  PrismaEntity,
  PrismaEnum,
  PrismaField,
  PrismaIndex,
  PrismaModel,
  PrismaRelationEdge,
  PrismaUnique,
} from './model.js';

function readField(f: DMMF.Field): PrismaField {
  const field: PrismaField = {
    name: f.name,
    type: f.type,
    kind:
      f.kind === 'enum'
        ? 'enum'
        : f.kind === 'unsupported'
          ? 'unsupported'
          : 'scalar',
    isList: f.isList,
    isRequired: f.isRequired,
    isUnique: f.isUnique,
    isUpdatedAt: f.isUpdatedAt ?? false,
    hasDefaultValue: f.hasDefaultValue,
    nativeType: f.nativeType ? [f.nativeType[0], [...f.nativeType[1]]] : null,
  };
  if (f.default !== undefined) {
    field.default = f.default as PrismaDefault;
  }
  if (f.documentation !== undefined) {
    field.doc = f.documentation;
  }
  return field;
}

function readEdge(f: DMMF.Field): PrismaRelationEdge {
  const edge: PrismaRelationEdge = {
    fieldName: f.name,
    relationName: f.relationName ?? '',
    targetEntity: f.type,
    isList: f.isList,
    isRequired: f.isRequired,
    fromFields: [...(f.relationFromFields ?? [])],
    toFields: [...(f.relationToFields ?? [])],
  };
  if (f.relationOnDelete !== undefined) {
    edge.onDelete = f.relationOnDelete;
  }
  if (f.relationOnUpdate !== undefined) {
    edge.onUpdate = f.relationOnUpdate;
  }
  return edge;
}

function readPrimaryKey(model: DMMF.Model): string[] {
  if (model.primaryKey && model.primaryKey.fields.length > 0) {
    return [...model.primaryKey.fields];
  }
  const id = model.fields.find((f) => f.isId);
  return id ? [id.name] : [];
}

function readUniques(model: DMMF.Model): PrismaUnique[] {
  if (model.uniqueIndexes.length > 0) {
    return model.uniqueIndexes.map((u) => {
      const entry: PrismaUnique = { fields: [...u.fields] };
      if (u.name) {
        entry.name = u.name;
      }
      return entry;
    });
  }
  return model.uniqueFields.map((fields) => ({ fields: [...fields] }));
}

function readIndexes(
  modelName: string,
  all: readonly DMMF.Index[] | undefined,
): PrismaIndex[] {
  if (!all) {
    return [];
  }
  return all
    .filter((idx) => idx.model === modelName && idx.type === 'normal')
    .map((idx) => {
      const entry: PrismaIndex = { fields: idx.fields.map((f) => f.name) };
      if (idx.name) {
        entry.name = idx.name;
      }
      if (idx.algorithm) {
        entry.type = idx.algorithm.toLowerCase();
      }
      return entry;
    });
}

function readEntity(model: DMMF.Model, doc: DMMF.Document): PrismaEntity {
  const fields: PrismaField[] = [];
  const relationEdges: PrismaRelationEdge[] = [];
  for (const f of model.fields) {
    if (f.kind === 'object') {
      relationEdges.push(readEdge(f));
    } else {
      fields.push(readField(f));
    }
  }
  const entity: PrismaEntity = {
    name: model.name,
    fields,
    relationEdges,
    primaryKey: readPrimaryKey(model),
    uniques: readUniques(model),
    indexes: readIndexes(model.name, doc.datamodel.indexes),
  };
  if (model.dbName) {
    entity.dbName = model.dbName;
  }
  if (model.documentation !== undefined) {
    entity.doc = model.documentation;
  }
  return entity;
}

function readEnum(e: DMMF.DatamodelEnum): PrismaEnum {
  const def: PrismaEnum = {
    name: e.name,
    values: e.values.map((value) => {
      const entry = { name: value.name } as PrismaEnum['values'][number];
      if (value.dbName) {
        entry.dbName = value.dbName;
      }
      return entry;
    }),
  };
  if (e.dbName) {
    def.dbName = e.dbName;
  }
  if (e.documentation !== undefined) {
    def.doc = e.documentation;
  }
  return def;
}

export function toPrismaModel(doc: DMMF.Document): PrismaModel {
  return {
    entities: doc.datamodel.models.map((m) => readEntity(m, doc)),
    enums: doc.datamodel.enums.map(readEnum),
  };
}
