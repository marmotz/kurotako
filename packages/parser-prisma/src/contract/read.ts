import type { ParseContext } from '@kurotako/core';
import type {
  PrismaDefault,
  PrismaEntity,
  PrismaEnum,
  PrismaField,
  PrismaModel,
  PrismaRelationEdge,
} from '../dmmf/model.js';
import { PrismaAmbiguousRelationError } from '../errors.js';
import type { PrismaParserOptions } from '../options.js';
import { mapCodec } from './codecs.js';
import { resolveNames } from './naming.js';
import { parseContract } from './schema.js';
import { assertSupportedVersion } from './version.js';

type RawRecord = Record<string, unknown>;

function record(value: unknown): RawRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RawRecord)
    : {};
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function storageTable(
  contract: RawRecord,
  namespace: string,
  tableName: string,
): RawRecord {
  const namespaces = record(record(contract.storage).namespaces);
  const entries = record(record(namespaces[namespace]).entries);
  return record(record(entries.table)[tableName]);
}

function defaultValue(value: unknown): PrismaDefault | undefined {
  const raw = record(value);
  if (raw.kind === 'literal') {
    return raw.value as PrismaDefault;
  }
  if (raw.kind === 'function' && typeof raw.expression === 'string') {
    const expression = raw.expression;
    const match = /^(\\w+)\\((.*)\\)$/.exec(expression);
    return match
      ? { name: match[1] ?? expression, args: [] }
      : { name: expression, args: [] };
  }
  return undefined;
}

function generatorDefault(
  contract: RawRecord,
  namespace: string,
  table: string,
  column: string,
): RawRecord | undefined {
  const defaults = record(
    record(record(contract.execution).mutations).defaults,
  );
  if (!Array.isArray(defaults)) return undefined;
  return defaults.map(record).find((entry) => {
    const ref = record(entry.ref);
    return (
      ref.namespace === namespace &&
      ref.table === table &&
      ref.column === column
    );
  });
}

function readField(
  name: string,
  raw: RawRecord,
  storageColumn: RawRecord,
  generator: RawRecord | undefined,
  logger: ParseContext['logger'],
): PrismaField {
  const type = record(raw.type);
  if (type.kind === 'valueObject') {
    return {
      name,
      type: typeof type.name === 'string' ? type.name : 'valueObject',
      kind: 'unsupported',
      isList: raw.many === true,
      isRequired: raw.nullable !== true,
      isUnique: false,
      isUpdatedAt: false,
      hasDefaultValue:
        generator !== undefined || storageColumn.default !== undefined,
      nativeType: null,
    };
  }
  const codecId = String(type.codecId);
  const mapped = mapCodec(codecId, logger);
  const valueSet = record(raw.valueSet);
  const isEnum = typeof valueSet.entityName === 'string';
  const typeParams = record(type.typeParams);
  const maxLength =
    mapped.needsLength && typeof typeParams.length === 'number'
      ? typeParams.length
      : undefined;
  const field: PrismaField = {
    name,
    type: isEnum ? String(valueSet.entityName) : codecId,
    kind: isEnum ? 'enum' : 'scalar',
    isList: raw.many === true,
    isRequired: raw.nullable !== true,
    isUnique: false,
    isUpdatedAt: record(generator?.onUpdate).id === 'instantNow',
    hasDefaultValue:
      generator !== undefined || storageColumn.default !== undefined,
    nativeType: null,
  };
  if (isEnum) return field;
  field.mappedType = mapped.type;
  field.scalarOverride = mapped.scalarOverride;
  field.format = mapped.format;
  field.maxLength = maxLength;
  const parsedDefault = defaultValue(storageColumn.default);
  if (parsedDefault !== undefined) field.default = parsedDefault;
  return field;
}

function readRelationEdges(
  relations: RawRecord,
  names: Map<string, string>,
  sourceName: string,
  table: RawRecord,
): PrismaRelationEdge[] {
  const foreignKeys = Array.isArray(table.foreignKeys)
    ? table.foreignKeys.map(record)
    : [];
  return Object.entries(relations).map(([fieldName, relation]) => {
    const raw = record(relation);
    const to = record(raw.to);
    const on = record(raw.on);
    const localFields = strings(on.localFields);
    const targetFields = strings(on.targetFields);
    const fk = foreignKeys.find((candidate) => {
      const source = record(candidate.source);
      return (
        JSON.stringify(strings(source.columns)) === JSON.stringify(localFields)
      );
    });
    const targetKey = `${String(to.namespace)}.${String(to.model)}`;
    const cardinality = raw.cardinality;
    const edge: PrismaRelationEdge = {
      fieldName,
      relationName:
        [sourceName, String(to.model)].sort().join(':') +
        `:${[...localFields, ...targetFields].sort().join(',')}`,
      targetEntity: names.get(targetKey) ?? String(to.model),
      isList: cardinality === '1:N' || cardinality === 'N:M',
      isRequired: cardinality !== '1:N' && cardinality !== 'N:M',
      fromFields: fk ? localFields : [],
      toFields: fk ? targetFields : [],
    };
    if (typeof fk?.onDelete === 'string') edge.onDelete = fk.onDelete;
    if (typeof fk?.onUpdate === 'string') edge.onUpdate = fk.onUpdate;
    return edge;
  });
}

export function readContract(
  raw: string,
  ctx: ParseContext,
  options: Pick<PrismaParserOptions, 'namespacePrefix' | 'rename'>,
): { model: PrismaModel; generatorVersion: string } {
  const parsed = parseContract(raw);
  assertSupportedVersion(parsed.schemaVersion);
  const contract = parsed as unknown as RawRecord;
  const namespaces = record(record(contract.domain).namespaces);
  const models = Object.entries(namespaces).flatMap(
    ([namespace, rawNamespace]) =>
      Object.keys(record(record(rawNamespace).models)).map((name) => ({
        namespace,
        name,
      })),
  );
  const modelCounts = new Map<string, number>();
  for (const model of models) {
    modelCounts.set(model.name, (modelCounts.get(model.name) ?? 0) + 1);
  }
  for (const rawNamespace of Object.values(namespaces)) {
    for (const rawModel of Object.values(record(record(rawNamespace).models))) {
      for (const relation of Object.values(
        record(record(rawModel).relations),
      )) {
        const target = record(record(relation).to);
        if (
          typeof target.model === 'string' &&
          (modelCounts.get(target.model) ?? 0) > 1
        ) {
          throw new PrismaAmbiguousRelationError(target.model);
        }
      }
    }
  }
  const names = resolveNames(models, options);
  const entities: PrismaEntity[] = [];
  const enums: PrismaEnum[] = [];
  for (const [namespace, rawNamespace] of Object.entries(namespaces)) {
    const namespaceData = record(rawNamespace);
    const modelDefs = record(namespaceData.models);
    for (const [sourceName, rawModel] of Object.entries(modelDefs)) {
      const model = record(rawModel);
      const bridge = record(model.storage);
      const tableName = String(bridge.table);
      const table = storageTable(
        contract,
        String(bridge.namespaceId),
        tableName,
      );
      const columns = record(table.columns);
      const bridgeFields = record(bridge.fields);
      const fields = Object.entries(record(model.fields)).map(
        ([name, rawField]) => {
          const column = String(record(bridgeFields[name]).column);
          return readField(
            name,
            record(rawField),
            record(columns[column]),
            generatorDefault(
              contract,
              String(bridge.namespaceId),
              tableName,
              column,
            ),
            ctx.logger,
          );
        },
      );
      const uniqueColumns = new Set(
        (Array.isArray(table.uniques) ? table.uniques : []).flatMap((entry) =>
          strings(record(entry).columns),
        ),
      );
      for (const field of fields)
        field.isUnique = uniqueColumns.has(field.name);
      const entity: PrismaEntity = {
        name: names.get(`${namespace}.${sourceName}`) ?? sourceName,
        dbName: tableName === sourceName ? undefined : tableName,
        fields,
        relationEdges: readRelationEdges(
          record(model.relations),
          names,
          sourceName,
          table,
        ),
        primaryKey: strings(record(table.primaryKey).columns),
        uniques: (Array.isArray(table.uniques) ? table.uniques : []).map(
          (entry) => ({
            fields: strings(record(entry).columns),
            ...(typeof record(entry).name === 'string'
              ? { name: String(record(entry).name) }
              : {}),
          }),
        ),
        indexes: (Array.isArray(table.indexes) ? table.indexes : []).map(
          (entry) => ({
            fields: strings(record(entry).columns),
            ...(typeof record(entry).name === 'string'
              ? { name: String(record(entry).name) }
              : {}),
            ...(typeof record(entry).type === 'string'
              ? { type: String(record(entry).type) }
              : {}),
          }),
        ),
      };
      entities.push(entity);
    }
    for (const [name, rawEnum] of Object.entries(record(namespaceData.enum))) {
      const members: unknown[] = Array.isArray(record(rawEnum).members)
        ? (record(rawEnum).members as unknown[])
        : [];
      enums.push({
        name,
        values: members.map((member) => {
          const value = record(member);
          return {
            name: String(value.name),
            ...(String(value.value) !== String(value.name)
              ? { dbName: String(value.value) }
              : {}),
          };
        }),
      });
    }
  }
  return { model: { entities, enums }, generatorVersion: parsed.schemaVersion };
}
