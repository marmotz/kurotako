import { dirname, resolve } from 'node:path';
import { $RefParser } from '@apidevtools/json-schema-ref-parser';
import { defineParser } from '@kurotako/config';
import type { ParseContext } from '@kurotako/core';
import type {
  Entity,
  Field,
  FieldType,
  SourceIR,
  StringFormat,
} from '@kurotako/ir';
import {
  OpenApiDocumentError,
  OpenApiInputError,
  OpenApiLoadError,
  OpenApiNameCollisionError,
  OpenApiReferenceError,
  OpenApiUnsupportedError,
} from './errors.js';
import { OpenApiParserOptions } from './options.js';

type Schema = Record<string, unknown>;

/**
 * JSON Schema keywords the v1 mapper cannot faithfully translate. Encountering
 * any of them is fatal rather than a silent downgrade, so generated validation
 * never claims a stronger contract than it implements.
 */
const UNSUPPORTED_KEYWORDS = [
  'multipleOf',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'patternProperties',
  'propertyNames',
  'unevaluatedProperties',
  'readOnly',
  'writeOnly',
  'not',
  'contentEncoding',
  'contentMediaType',
] as const;

/** String `format` values that map onto an existing IR `StringFormat`. */
const STRING_FORMATS: Record<string, StringFormat> = {
  email: 'email',
  uri: 'url',
  url: 'url',
  ipv4: 'ipv4',
  ipv6: 'ipv6',
  time: 'time',
  duration: 'duration',
};

function rejectUnsupported(schema: Schema): void {
  for (const keyword of UNSUPPORTED_KEYWORDS) {
    if (schema[keyword] !== undefined)
      throw new OpenApiUnsupportedError(
        `unsupported JSON Schema keyword '${keyword}'`,
      );
  }
}

/**
 * Normalise the `type` keyword across OpenAPI 3.0 (`nullable: true`) and 3.1
 * (`type: ['string', 'null']`): the non-null members plus a nullability flag.
 */
function typeMembers(schema: Schema): { types: string[]; nullable: boolean } {
  const raw = schema.type;
  if (Array.isArray(raw)) {
    const all = raw.filter((item): item is string => typeof item === 'string');
    return {
      types: all.filter((item) => item !== 'null'),
      nullable: all.includes('null'),
    };
  }
  return {
    types: typeof raw === 'string' ? [raw] : [],
    nullable: schema.nullable === true,
  };
}

/** `hello world` / `hello-world` -> `HelloWorld`. */
function pascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

/** `application/json` -> `Json`; `application/vnd.api+json` -> `VndApiJson`. */
function mediaName(media: string): string {
  return pascalCase(media.split('/').pop() ?? media);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null ||
    Array.isArray(a) !== Array.isArray(b)
  )
    return false;
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) =>
    deepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

function jsonValue(value: unknown): boolean {
  try {
    return JSON.parse(JSON.stringify(value)) !== undefined;
  } catch {
    return false;
  }
}

function urlDocument(document: string): URL | undefined {
  try {
    return new URL(document);
  } catch {
    return undefined;
  }
}

function rootDocument(cwd: string, document: string): string {
  const url = urlDocument(document);
  if (url === undefined) return resolve(cwd, document);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new OpenApiInputError(
      `document URL must be unauthenticated HTTP(S): '${document}'`,
    );
  }
  return url.href;
}

function scalar(type: string, format: unknown): FieldType {
  if (type === 'boolean') return { kind: 'scalar', scalar: 'boolean' };
  if (type === 'integer')
    return { kind: 'scalar', scalar: format === 'int64' ? 'bigint' : 'int' };
  if (type === 'number') return { kind: 'scalar', scalar: 'float' };
  if (format === 'date') return { kind: 'scalar', scalar: 'date' };
  if (format === 'date-time') return { kind: 'scalar', scalar: 'datetime' };
  if (format === 'uuid') return { kind: 'scalar', scalar: 'uuid' };
  if (format === 'byte' || format === 'binary')
    return { kind: 'scalar', scalar: 'bytes' };
  return { kind: 'scalar', scalar: 'string' };
}

function field(
  name: string,
  type: FieldType,
  required: boolean,
  schema: Schema,
): Field {
  const constraints: Field['constraints'] = {};
  for (const [from, to] of [
    ['minimum', 'min'],
    ['maximum', 'max'],
    ['minLength', 'minLength'],
    ['maxLength', 'maxLength'],
  ] as const) {
    if (typeof schema[from] === 'number')
      constraints[to] = schema[from] as number;
  }
  if (typeof schema.pattern === 'string') constraints.regex = schema.pattern;
  if (
    typeof schema.format === 'string' &&
    STRING_FORMATS[schema.format] !== undefined &&
    type.kind === 'scalar' &&
    type.scalar === 'string'
  )
    constraints.format = STRING_FORMATS[schema.format];
  const entry: Field = {
    name,
    type,
    list: false,
    optional: !required,
    nullable: typeMembers(schema).nullable,
    constraints,
    ...(typeof schema.description === 'string'
      ? { doc: schema.description }
      : {}),
  };
  if (schema.default !== undefined && jsonValue(schema.default))
    entry.default = { kind: 'value', value: schema.default as never };
  return entry;
}

function pointerName(ref: string): string | undefined {
  const match = /#\/components\/schemas\/([^/]+)$/.exec(ref);
  return match?.[1];
}

function mapSchema(
  schema: Schema,
  names: Set<string>,
  resolveRef?: (ref: string) => Schema | undefined,
  external?: Map<string, Schema>,
): FieldType {
  if (typeof schema.$ref === 'string') {
    const name = pointerName(schema.$ref);
    if (name === undefined)
      throw new OpenApiReferenceError(
        `unsupported or unresolved schema reference '${schema.$ref}'`,
      );
    if (!names.has(name)) {
      const target = resolveRef?.(schema.$ref);
      if (target === undefined)
        throw new OpenApiReferenceError(
          `unresolved schema reference '${schema.$ref}'`,
        );
      names.add(name);
      external?.set(name, target);
    }
    return { kind: 'ref', ref: name };
  }
  rejectUnsupported(schema);
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf)) {
    const items = (schema.oneOf ?? schema.anyOf) as unknown[];
    const variants = items.map((item) =>
      mapSchema(asSchema(item), names, resolveRef, external),
    );
    const union: FieldType = { kind: 'union', variants };
    const discriminator = asSchema(schema.discriminator ?? {});
    if (
      typeof discriminator.propertyName === 'string' &&
      variants.every((variant) => variant.kind === 'ref')
    ) {
      const mapping = discriminator.mapping;
      union.discriminator = {
        propertyName: discriminator.propertyName,
        ...(mapping !== null && typeof mapping === 'object'
          ? {
              mapping: Object.fromEntries(
                Object.entries(mapping as Record<string, unknown>).map(
                  ([key, value]) => [
                    key,
                    pointerName(String(value)) ?? String(value),
                  ],
                ),
              ),
            }
          : {}),
      };
    }
    return union;
  }
  if (Array.isArray(schema.type)) {
    const { types } = typeMembers(schema);
    if (types.length === 0) return { kind: 'unknown' };
    if (types.length === 1)
      return mapSchema(
        { ...schema, type: types[0] },
        names,
        resolveRef,
        external,
      );
    return {
      kind: 'union',
      variants: types.map((type) =>
        mapSchema({ ...schema, type }, names, resolveRef, external),
      ),
    };
  }
  if (schema.type === 'array') {
    const items = asSchema(schema.items);
    if (items.type === 'array')
      throw new OpenApiUnsupportedError('nested arrays are not supported');
    return mapSchema(items, names, resolveRef, external);
  }
  if (
    schema.type === 'object' ||
    schema.properties !== undefined ||
    schema.additionalProperties !== undefined
  ) {
    if (
      schema.properties === undefined &&
      schema.additionalProperties !== undefined
    ) {
      return {
        kind: 'map',
        value:
          schema.additionalProperties === true
            ? { kind: 'unknown' }
            : mapSchema(
                asSchema(schema.additionalProperties),
                names,
                resolveRef,
                external,
              ),
      };
    }
    return { kind: 'unknown', hint: 'object' };
  }
  if (
    Array.isArray(schema.enum) &&
    schema.enum.every((item) => typeof item === 'string')
  )
    return { kind: 'unknown', hint: 'enum' };
  return scalar(
    typeof schema.type === 'string' ? schema.type : 'string',
    schema.format,
  );
}

function asSchema(value: unknown): Schema {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    throw new OpenApiDocumentError('expected a schema object');
  return value as Schema;
}

function buildSource(
  namespace: string,
  document: Schema,
  resolveRef?: (ref: string) => Schema | undefined,
): SourceIR {
  if (
    typeof document.openapi !== 'string' ||
    !/^3\.[01]/.test(document.openapi)
  )
    throw new OpenApiDocumentError('expected an OpenAPI 3.0 or 3.1 document');
  const schemas = asSchema(asSchema(document.components ?? {}).schemas ?? {});
  const names = new Set(Object.keys(schemas));
  const entities: Record<string, Entity> = {};
  const enums: SourceIR['enums'] = {};
  const aliases: NonNullable<SourceIR['typeAliases']> = {};
  const external = new Map<string, Schema>();
  const allocated = new Map<string, Schema>();
  const claim = (name: string, schema: Schema): boolean => {
    const previous = allocated.get(name);
    if (previous !== undefined && previous !== schema)
      throw new OpenApiNameCollisionError(
        `name '${name}' is claimed by two different schemas`,
      );
    allocated.set(name, schema);
    return entities[name] === undefined && aliases[name] === undefined;
  };
  /** Resolve an `allOf` entry, following one `$ref` and flattening nested `allOf`. */
  const flattenAllOf = (schema: Schema): Schema[] => {
    if (!Array.isArray(schema.allOf)) return [];
    return schema.allOf.flatMap((part) => {
      const value = asSchema(part);
      const resolved =
        typeof value.$ref === 'string'
          ? (resolveRef?.(value.$ref) ?? value)
          : value;
      return [resolved, ...flattenAllOf(resolved)];
    });
  };
  const addNamedSchema = (name: string, schema: Schema): void => {
    if (!claim(name, schema)) return;
    rejectUnsupported(schema);
    const allOf = flattenAllOf(schema);
    // `allOf` combines properties; a property declared by more than one member
    // must map to an identical shape, otherwise the contract is ambiguous.
    const seenProperties = new Map<string, unknown>();
    for (const part of [...allOf, schema]) {
      for (const [key, value] of Object.entries(
        asSchema(part.properties ?? {}),
      )) {
        if (
          seenProperties.has(key) &&
          !deepEqual(seenProperties.get(key), value)
        )
          throw new OpenApiUnsupportedError(
            `allOf combines incompatible shapes for property '${key}'`,
          );
        seenProperties.set(key, value);
      }
    }
    const properties = Object.assign(
      {},
      ...allOf.map((part) => asSchema(part.properties ?? {})),
      asSchema(schema.properties ?? {}),
    );
    const required = new Set(
      [...allOf, schema].flatMap((part) =>
        Array.isArray(part.required)
          ? part.required.filter(
              (item): item is string => typeof item === 'string',
            )
          : [],
      ),
    );
    if (schema.type === 'object' || Object.keys(properties).length > 0) {
      const fields = Object.entries(properties).map(([key, value]) => {
        const property = asSchema(value);
        const inline =
          property.type === 'array' ? asSchema(property.items) : property;
        // A `title` on an inline schema names the synthetic entity; without one
        // the owner entity + field name is used (`UserAddress`).
        const inlineName =
          typeof inline.title === 'string' && pascalCase(inline.title) !== ''
            ? pascalCase(inline.title)
            : `${name}${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        const synthesizeInline =
          typeof inline.$ref !== 'string' &&
          (inline.type === 'object' || inline.properties !== undefined) &&
          inline.additionalProperties === undefined;
        let type: FieldType;
        if (synthesizeInline) {
          addNamedSchema(inlineName, inline);
          type = { kind: 'ref', ref: inlineName };
        } else {
          type = mapSchema(inline, names, resolveRef, external);
        }
        const entry = field(key, type, required.has(key), property);
        if (property.type === 'array') entry.list = true;
        return entry;
      });
      const extra = schema.additionalProperties;
      entities[name] = {
        name,
        fields,
        relations: [],
        indexes: [],
        uniques: [],
        ...(extra !== undefined && extra !== false
          ? {
              additionalProperties:
                extra === true
                  ? { kind: 'unknown' }
                  : mapSchema(asSchema(extra), names, resolveRef, external),
            }
          : {}),
        ...(typeof schema.description === 'string'
          ? { doc: schema.description }
          : {}),
      };
    } else {
      aliases[name] = {
        name,
        type: mapSchema(schema, names, resolveRef, external),
        ...(typeof schema.description === 'string'
          ? { doc: schema.description }
          : {}),
      };
    }
  };
  for (const [name, raw] of Object.entries(schemas)) {
    const schema = asSchema(raw);
    if (
      Array.isArray(schema.enum) &&
      schema.enum.every((value): value is string => typeof value === 'string')
    ) {
      claim(name, schema);
      enums[name] = {
        name,
        values: schema.enum.map((value) => ({ name: value })),
      };
      aliases[name] = { name, type: { kind: 'enum', ref: name } };
    } else {
      addNamedSchema(name, schema);
    }
  }
  const materializeExternal = (): void => {
    for (const [name, schema] of external) addNamedSchema(name, schema);
  };
  materializeExternal();

  const paths = document.paths;
  if (paths !== undefined) {
    for (const [path, rawItem] of Object.entries(asSchema(paths))) {
      const item = asSchema(rawItem);
      for (const method of [
        'get',
        'put',
        'post',
        'delete',
        'patch',
        'head',
        'options',
      ]) {
        if (item[method] === undefined) continue;
        const operation = asSchema(item[method]);
        const operationName =
          typeof operation.operationId === 'string'
            ? operation.operationId.charAt(0).toUpperCase() +
              operation.operationId.slice(1)
            : `${method.charAt(0).toUpperCase()}${method.slice(1)}${path
                .split('/')
                .filter(Boolean)
                .map((segment) => {
                  const parameter = /^\{(.+)\}$/.exec(segment)?.[1];
                  const word =
                    parameter === undefined
                      ? segment
                      : `By${parameter.charAt(0).toUpperCase()}${parameter.slice(1)}`;
                  return word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join('')}`;
        const addPayload = (name: string, value: unknown): void => {
          const schema = asSchema(value);
          if (schema.type === 'object' || schema.properties !== undefined)
            addNamedSchema(name, schema);
          else if (claim(name, schema))
            aliases[name] = {
              name,
              type: mapSchema(schema, names, resolveRef, external),
            };
        };
        const request =
          operation.requestBody === undefined
            ? undefined
            : asSchema(operation.requestBody);
        for (const content of Object.values(asSchema(request?.content ?? {}))) {
          const schema = asSchema(content).schema;
          if (schema !== undefined)
            addPayload(`${operationName}Request`, schema);
        }
        for (const [status, response] of Object.entries(
          asSchema(operation.responses ?? {}),
        )) {
          for (const [media, content] of Object.entries(
            asSchema(asSchema(response).content ?? {}),
          )) {
            const schema = asSchema(content).schema;
            if (schema !== undefined)
              addPayload(
                `${operationName}${status.charAt(0).toUpperCase()}${status.slice(1)}Response${mediaName(media)}`,
                schema,
              );
          }
        }
        const parameters = [
          ...(Array.isArray(item.parameters) ? item.parameters : []),
          ...(Array.isArray(operation.parameters) ? operation.parameters : []),
        ];
        for (const rawParameter of parameters) {
          const parameter = asSchema(rawParameter);
          if (
            typeof parameter.name !== 'string' ||
            typeof parameter.in !== 'string' ||
            parameter.schema === undefined
          )
            continue;
          addPayload(
            `${operationName}${parameter.in.charAt(0).toUpperCase()}${parameter.in.slice(1)}${parameter.name.charAt(0).toUpperCase()}${parameter.name.slice(1)}`,
            parameter.schema,
          );
        }
      }
    }
  }
  materializeExternal();
  return {
    namespace,
    parser: 'openapi',
    entities,
    enums,
    ...(Object.keys(aliases).length ? { typeAliases: aliases } : {}),
  };
}

export const openapiParser = defineParser({
  name: 'openapi',
  optionsSchema: OpenApiParserOptions,
  async parse(ctx: ParseContext, options): Promise<SourceIR> {
    const document = rootDocument(ctx.cwd, options.document);
    try {
      const parser = new $RefParser();
      await parser.resolve(document, {
        resolve: { http: { safeUrlResolver: true, withCredentials: false } },
      });
      return buildSource(ctx.namespace, asSchema(parser.schema), (ref) => {
        const target = parser.$refs.get(ref);
        return target !== null &&
          typeof target === 'object' &&
          !Array.isArray(target)
          ? (target as Schema)
          : undefined;
      });
    } catch (error) {
      if (
        error instanceof OpenApiInputError ||
        error instanceof OpenApiDocumentError ||
        error instanceof OpenApiReferenceError ||
        error instanceof OpenApiUnsupportedError ||
        error instanceof OpenApiNameCollisionError
      )
        throw error;
      throw new OpenApiLoadError(`could not resolve '${document}'`, {
        cause: error,
      });
    }
  },
  async watchPaths(ctx: ParseContext, options): Promise<string[]> {
    return urlDocument(options.document) === undefined
      ? [resolve(ctx.cwd, options.document)]
      : [];
  },
  anchor(rootDir, options): string | undefined {
    return urlDocument(options.document) === undefined
      ? dirname(resolve(rootDir, options.document))
      : undefined;
  },
});
