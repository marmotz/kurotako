import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { openapiParser } from './parser.js';

async function fixture(name: string, content: string): Promise<string> {
  const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
  await writeFile(join(cwd, name), content);
  return cwd;
}

function document(schemas: Record<string, unknown>): string {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Test', version: '1' },
    paths: {},
    components: { schemas },
  });
}

const context = (cwd: string) =>
  ({
    cwd,
    namespace: 'api',
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  }) as never;

describe('openapiParser', () => {
  it('resolves a local document and maps components, refs and typed maps', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
    await writeFile(
      join(cwd, 'openapi.json'),
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              required: ['id'],
              properties: {
                id: { type: 'string' },
                labels: {
                  type: 'object',
                  additionalProperties: { type: 'string' },
                },
                manager: { $ref: '#/components/schemas/User' },
              },
              additionalProperties: { type: 'integer' },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    expect(
      source.entities.User?.fields.find((field) => field.name === 'labels')
        ?.type,
    ).toEqual({ kind: 'map', value: { kind: 'scalar', scalar: 'string' } });
    expect(source.entities.User?.additionalProperties).toEqual({
      kind: 'scalar',
      scalar: 'int',
    });
    expect(
      source.entities.User?.fields.find((field) => field.name === 'manager')
        ?.type,
    ).toEqual({ kind: 'ref', ref: 'User' });
    expect(
      await openapiParser.watchPaths?.(context(cwd), {
        document: 'openapi.json',
      }),
    ).toEqual([join(cwd, 'openapi.json')]);
  });

  it('rejects authenticated and unsupported document URLs', async () => {
    await expect(
      openapiParser.parse(context('/tmp'), {
        document: 'ftp://example.test/openapi.json',
      }),
    ).rejects.toMatchObject({ code: 'openapi_input' });
    await expect(
      openapiParser.parse(context('/tmp'), {
        document: 'https://secret@example.test/openapi.json',
      }),
    ).rejects.toMatchObject({ code: 'openapi_input' });
  });

  it('materializes request, response and parameter payload schemas', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
    await writeFile(
      join(cwd, 'operations.json'),
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        paths: {
          '/users/{id}': {
            get: {
              operationId: 'getUser',
              parameters: [
                { name: 'id', in: 'path', schema: { type: 'string' } },
              ],
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: { id: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
            post: {
              requestBody: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: { name: { type: 'string' } },
                    },
                  },
                },
              },
              responses: { '204': { description: 'done' } },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'operations.json',
    });
    expect(source.entities.GetUser200ResponseJson).toBeDefined();
    expect(source.typeAliases?.GetUserPathId).toBeDefined();
    expect(source.entities.PostUsersByIdRequest).toBeDefined();
  });

  it('preserves array-ness for array roots, nested arrays and array payloads', async () => {
    const cwd = await fixture(
      'openapi.json',
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1' },
        paths: {
          '/tasks': {
            get: {
              operationId: 'listTasks',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Task' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        components: {
          schemas: {
            Task: {
              type: 'object',
              required: ['id'],
              properties: { id: { type: 'string' } },
            },
            Matrix: {
              type: 'array',
              items: { type: 'array', items: { type: 'integer' } },
            },
            Board: {
              type: 'object',
              properties: {
                tags: { type: 'array', items: { type: 'string' } },
                grid: {
                  type: 'array',
                  items: { type: 'array', items: { type: 'integer' } },
                },
              },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    expect(source.typeAliases?.ListTasks200ResponseJson?.type).toEqual({
      kind: 'array',
      element: { kind: 'ref', ref: 'Task' },
    });
    expect(source.typeAliases?.Matrix?.type).toEqual({
      kind: 'array',
      element: { kind: 'array', element: { kind: 'scalar', scalar: 'int' } },
    });
    const tags = source.entities.Board?.fields.find((f) => f.name === 'tags');
    expect(tags?.list).toBe(true);
    expect(tags?.type).toEqual({ kind: 'scalar', scalar: 'string' });
    // A nested-array object property: the outer level uses the `list` fast path,
    // the inner level the `array` field type — `int[][]` either way.
    const grid = source.entities.Board?.fields.find((f) => f.name === 'grid');
    expect(grid?.list).toBe(true);
    expect(grid?.type).toEqual({
      kind: 'array',
      element: { kind: 'scalar', scalar: 'int' },
    });
  });

  it('maps named string enums and merges object allOf members', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
    await writeFile(
      join(cwd, 'composition.json'),
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1' },
        paths: {},
        components: {
          schemas: {
            Status: { type: 'string', enum: ['ready', 'done'] },
            Job: {
              allOf: [
                {
                  type: 'object',
                  required: ['id'],
                  properties: { id: { type: 'string' } },
                },
                {
                  type: 'object',
                  properties: {
                    status: { $ref: '#/components/schemas/Status' },
                  },
                },
              ],
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'composition.json',
    });
    expect(source.enums.Status?.values.map((value) => value.name)).toEqual([
      'ready',
      'done',
    ]);
    expect(source.entities.Job?.fields.map((field) => field.name)).toEqual([
      'id',
      'status',
    ]);
  });

  it('materializes an externally resolved component reference', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
    await writeFile(
      join(cwd, 'shared.json'),
      JSON.stringify({
        components: {
          schemas: {
            Address: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        },
      }),
    );
    await writeFile(
      join(cwd, 'root.json'),
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                address: { $ref: 'shared.json#/components/schemas/Address' },
              },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'root.json',
    });
    expect(source.entities.Address?.fields[0]?.name).toBe('city');
    expect(source.entities.User?.fields[0]?.type).toEqual({
      kind: 'ref',
      ref: 'Address',
    });
  });

  it('allocates inline object schemas once with an owner-derived name', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-'));
    await writeFile(
      join(cwd, 'inline.json'),
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        paths: {},
        components: {
          schemas: {
            User: {
              type: 'object',
              properties: {
                address: {
                  type: 'object',
                  properties: { city: { type: 'string' } },
                },
              },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'inline.json',
    });
    expect(source.entities.UserAddress?.fields[0]?.name).toBe('city');
    expect(source.entities.User?.fields[0]?.type).toEqual({
      kind: 'ref',
      ref: 'UserAddress',
    });
  });

  it('maps string formats, defaults and OpenAPI 3.1 nullable unions', async () => {
    const cwd = await fixture(
      'openapi.json',
      document({
        Contact: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            website: { type: 'string', format: 'uri' },
            role: { type: 'string', default: 'guest' },
            age: { type: ['integer', 'null'] },
            score: { type: ['integer', 'string'] },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    const fields = source.entities.Contact?.fields ?? [];
    expect(fields.find((f) => f.name === 'email')?.constraints.format).toBe(
      'email',
    );
    expect(fields.find((f) => f.name === 'website')?.constraints.format).toBe(
      'url',
    );
    expect(fields.find((f) => f.name === 'role')?.default).toEqual({
      kind: 'value',
      value: 'guest',
    });
    expect(fields.find((f) => f.name === 'age')?.nullable).toBe(true);
    expect(fields.find((f) => f.name === 'age')?.type).toEqual({
      kind: 'scalar',
      scalar: 'int',
    });
    expect(fields.find((f) => f.name === 'score')?.type).toEqual({
      kind: 'union',
      variants: [
        { kind: 'scalar', scalar: 'int' },
        { kind: 'scalar', scalar: 'string' },
      ],
    });
  });

  it('copies a discriminator when every oneOf variant is a same-source ref', async () => {
    const cwd = await fixture(
      'openapi.json',
      document({
        Cat: { type: 'object', properties: { kind: { type: 'string' } } },
        Dog: { type: 'object', properties: { kind: { type: 'string' } } },
        Pet: {
          oneOf: [
            { $ref: '#/components/schemas/Cat' },
            { $ref: '#/components/schemas/Dog' },
          ],
          discriminator: {
            propertyName: 'kind',
            mapping: {
              cat: '#/components/schemas/Cat',
              dog: '#/components/schemas/Dog',
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    expect(source.typeAliases?.Pet?.type).toEqual({
      kind: 'union',
      variants: [
        { kind: 'ref', ref: 'Cat' },
        { kind: 'ref', ref: 'Dog' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: { cat: 'Cat', dog: 'Dog' },
      },
    });
  });

  it('rejects unsupported JSON Schema keywords with a located error', async () => {
    const cwd = await fixture(
      'openapi.json',
      document({
        Money: {
          type: 'object',
          properties: { amount: { type: 'number', multipleOf: 0.01 } },
        },
      }),
    );
    await expect(
      openapiParser.parse(context(cwd), { document: 'openapi.json' }),
    ).rejects.toMatchObject({ code: 'openapi_unsupported' });
  });

  it('fails on a name collision instead of auto-suffixing', async () => {
    const cwd = await fixture(
      'openapi.json',
      document({
        UserAddress: {
          type: 'object',
          properties: { zip: { type: 'string' } },
        },
        User: {
          type: 'object',
          properties: {
            address: {
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        },
      }),
    );
    await expect(
      openapiParser.parse(context(cwd), { document: 'openapi.json' }),
    ).rejects.toMatchObject({ code: 'openapi_name_collision' });
  });

  it('merges allOf members and rejects incompatible duplicate properties', async () => {
    const ok = await fixture(
      'ok.json',
      document({
        Base: { type: 'object', properties: { id: { type: 'string' } } },
        Extended: {
          allOf: [
            { $ref: '#/components/schemas/Base' },
            { type: 'object', properties: { id: { type: 'string' } } },
          ],
        },
      }),
    );
    const source = await openapiParser.parse(context(ok), {
      document: 'ok.json',
    });
    expect(source.entities.Extended?.fields.map((f) => f.name)).toEqual(['id']);

    const bad = await fixture(
      'bad.json',
      document({
        Conflict: {
          allOf: [
            { type: 'object', properties: { id: { type: 'string' } } },
            { type: 'object', properties: { id: { type: 'integer' } } },
          ],
        },
      }),
    );
    await expect(
      openapiParser.parse(context(bad), { document: 'bad.json' }),
    ).rejects.toMatchObject({ code: 'openapi_unsupported' });
  });

  it('names a synthetic inline entity from its title when present', async () => {
    const cwd = await fixture(
      'openapi.json',
      document({
        User: {
          type: 'object',
          properties: {
            address: {
              title: 'Postal Address',
              type: 'object',
              properties: { city: { type: 'string' } },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    expect(source.entities.PostalAddress?.fields[0]?.name).toBe('city');
    expect(source.entities.User?.fields[0]?.type).toEqual({
      kind: 'ref',
      ref: 'PostalAddress',
    });
  });

  it('disambiguates response payloads by status and media type, and watches the local file', async () => {
    const cwd = await fixture(
      'operations.json',
      JSON.stringify({
        openapi: '3.0.3',
        info: { title: 'Test', version: '1' },
        paths: {
          '/items': {
            get: {
              operationId: 'listItems',
              responses: {
                '200': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: { total: { type: 'integer' } },
                      },
                    },
                    'application/xml': {
                      schema: {
                        type: 'object',
                        properties: { total: { type: 'string' } },
                      },
                    },
                  },
                },
                '404': {
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: { message: { type: 'string' } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'operations.json',
    });
    expect(source.entities.ListItems200ResponseJson).toBeDefined();
    expect(source.entities.ListItems200ResponseXml).toBeDefined();
    expect(source.entities.ListItems404ResponseJson).toBeDefined();
    expect(
      await openapiParser.watchPaths?.(context(cwd), {
        document: 'operations.json',
      }),
    ).toEqual([join(cwd, 'operations.json')]);
    expect(
      await openapiParser.watchPaths?.(context(cwd), {
        document: 'https://example.test/operations.json',
      }),
    ).toEqual([]);
  });

  it('resolves a YAML document and exposes a local anchor', async () => {
    const cwd = await fixture(
      'openapi.yaml',
      [
        'openapi: 3.0.3',
        'info:',
        '  title: Test',
        '  version: "1"',
        'paths: {}',
        'components:',
        '  schemas:',
        '    Tag:',
        '      type: object',
        '      properties:',
        '        name:',
        '          type: string',
      ].join('\n'),
    );
    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.yaml',
    });
    expect(source.entities.Tag?.fields[0]?.name).toBe('name');
    expect(openapiParser.anchor?.(cwd, { document: 'openapi.yaml' })).toBe(cwd);
    expect(
      openapiParser.anchor?.(cwd, { document: 'https://example.test/o.yaml' }),
    ).toBeUndefined();
  });
});
