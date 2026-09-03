import {
  ConfigShapeError,
  DriverOptionsError,
  UnknownNamespaceError,
} from '@kurotako/config';
import {
  DependencyCycleError,
  DriverError,
  IrValidationError,
  TakoError,
} from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import { ConfigExistsError, renderError } from './errors.js';

describe('ConfigExistsError', () => {
  it('is a TakoError with code config_exists', () => {
    const error = new ConfigExistsError('/tmp/tako.config.ts');
    expect(error).toBeInstanceOf(TakoError);
    expect(error.code).toBe('config_exists');
    expect(error.path).toBe('/tmp/tako.config.ts');
  });
});

describe('renderError', () => {
  it('renders the base line for a plain TakoError', () => {
    expect(renderError(new TakoError('boom', 'it broke'))).toBe(
      'error [boom]: it broke',
    );
  });

  it('appends located issues (ConfigShapeError)', () => {
    const out = renderError(
      new ConfigShapeError([
        { path: 'sources', message: 'required' },
        { path: '', message: 'bad root' },
      ]),
    );
    expect(out).toContain('error [config_invalid]:');
    expect(out).toContain('\n  - sources: required');
    expect(out).toContain('\n  - <root>: bad root');
  });

  it('appends the dependency cycle path', () => {
    const out = renderError(new DependencyCycleError(['a', 'b', 'a']));
    expect(out).toContain('\n  cycle: a -> b -> a');
  });

  it('names the offending driver and namespace (DriverError)', () => {
    const out = renderError(
      new DriverError('parser', 'prisma', { namespace: 'pg' }),
    );
    expect(out).toContain("\n  parser: prisma (namespace 'pg')");
  });

  it('appends the cause message and code of a wrapped failure', () => {
    const out = renderError(
      new DriverError('parser', 'prisma', {
        namespace: 'pg',
        cause: new TakoError('prisma_schema_invalid', 'line 3: unknown type'),
      }),
    );
    expect(out).toContain(
      '\n  cause [prisma_schema_invalid]: line 3: unknown type',
    );
  });

  it('lists located issues for IrValidationError', () => {
    const out = renderError(
      new IrValidationError(
        [{ path: 'User.id', code: 'shape', message: 'expected uuid' }],
        'pg',
      ),
    );
    expect(out).toContain('error [ir_invalid]:');
    expect(out).toContain('\n  - User.id: expected uuid');
  });

  it('lists located issues and the driver for DriverOptionsError', () => {
    const out = renderError(
      new DriverOptionsError(
        'parser',
        'prisma',
        [{ path: 'schema', message: 'expected string' }],
        'pg',
      ),
    );
    expect(out).toContain('\n  - schema: expected string');
    expect(out).toContain("\n  parser: prisma (namespace 'pg')");
  });

  it('names the generator and namespace for UnknownNamespaceError', () => {
    const out = renderError(new UnknownNamespaceError('zod', 'missing'));
    expect(out).toContain("\n  generator: zod (namespace 'missing')");
  });
});
