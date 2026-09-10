/**
 * Remote-document behaviour with the reference resolver stubbed — no test makes
 * a real HTTP request. Proves the driver forwards an HTTP(S) URL to the resolver,
 * maps the resolved document, and treats a remote root as unwatchable.
 */
import { describe, expect, it, vi } from 'vitest';

const REMOTE_DOCUMENT = {
  openapi: '3.1.0',
  info: { title: 'Remote', version: '1' },
  paths: {},
  components: {
    schemas: {
      Widget: { type: 'object', properties: { id: { type: 'string' } } },
    },
  },
};

const resolveSpy = vi.fn(async (document: string) => {
  if (!/^https?:\/\//.test(document))
    throw new Error(`expected an HTTP(S) URL, got '${document}'`);
});

vi.mock('@apidevtools/json-schema-ref-parser', () => ({
  $RefParser: class {
    schema: unknown = REMOTE_DOCUMENT;
    $refs = { get: () => undefined };
    resolve = resolveSpy;
  },
}));

const { openapiParser } = await import('./parser.js');

const context = (cwd: string) =>
  ({
    cwd,
    namespace: 'api',
    logger: { debug() {}, info() {}, warn() {}, error() {} },
  }) as never;

describe('openapiParser — remote documents', () => {
  it('forwards an HTTP(S) URL to the resolver and maps the resolved document', async () => {
    const source = await openapiParser.parse(context('/tmp'), {
      document: 'https://api.example.test/openapi.json',
    });
    expect(resolveSpy).toHaveBeenCalledWith(
      'https://api.example.test/openapi.json',
      expect.anything(),
    );
    expect(source.entities.Widget?.fields[0]?.name).toBe('id');
  });

  it('does not watch a remote root and exposes no anchor', async () => {
    const options = { document: 'https://api.example.test/openapi.json' };
    expect(await openapiParser.watchPaths?.(context('/tmp'), options)).toEqual(
      [],
    );
    expect(openapiParser.anchor?.('/tmp', options)).toBeUndefined();
  });

  it('rejects a credential-bearing URL before contacting the resolver', async () => {
    resolveSpy.mockClear();
    await expect(
      openapiParser.parse(context('/tmp'), {
        document: 'https://user:pass@api.example.test/openapi.json',
      }),
    ).rejects.toMatchObject({ code: 'openapi_input' });
    expect(resolveSpy).not.toHaveBeenCalled();
  });
});
