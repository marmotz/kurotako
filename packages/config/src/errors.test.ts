import { TakoError } from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import {
  ConfigLoadError,
  ConfigNotFoundError,
  ConfigShapeError,
  DriverOptionsError,
  DuplicateGeneratorError,
  NoDefaultExportError,
  UnknownNamespaceError,
} from './errors.js';

describe('config errors', () => {
  it('are all instances of TakoError with a stable code', () => {
    const cases: [TakoError, string][] = [
      [new ConfigNotFoundError('nope'), 'config_not_found'],
      [new ConfigLoadError('/x/tako.config.ts'), 'config_load_error'],
      [
        new NoDefaultExportError('/x/tako.config.ts'),
        'config_no_default_export',
      ],
      [new ConfigShapeError([{ path: 'a', message: 'b' }]), 'config_invalid'],
      [new DuplicateGeneratorError('zod'), 'config_duplicate_generator'],
      [new UnknownNamespaceError('zod', 'nope'), 'config_unknown_namespace'],
      [
        new DriverOptionsError(
          'parser',
          'prisma',
          [{ path: 'x', message: 'y' }],
          'pg',
        ),
        'driver_options_invalid',
      ],
    ];
    for (const [err, code] of cases) {
      expect(err).toBeInstanceOf(TakoError);
      expect(err).toBeInstanceOf(Error);
      expect(err.code).toBe(code);
      expect(err.name).toBe(err.constructor.name);
    }
  });

  it('ConfigLoadError preserves cause', () => {
    const cause = new Error('boom');
    const err = new ConfigLoadError('/x/tako.config.ts', { cause });
    expect(err.cause).toBe(cause);
    expect(err.configFile).toBe('/x/tako.config.ts');
  });

  it('ConfigShapeError and DriverOptionsError carry located issues', () => {
    const shape = new ConfigShapeError([
      { path: 'generators.0.use', message: 'bad' },
    ]);
    expect(shape.issues).toEqual([
      { path: 'generators.0.use', message: 'bad' },
    ]);

    const driver = new DriverOptionsError('generator', 'zod', [
      { path: 'dialect', message: 'invalid' },
    ]);
    expect(driver.role).toBe('generator');
    expect(driver.driverName).toBe('zod');
    expect(driver.namespace).toBeUndefined();
    expect(driver.issues).toHaveLength(1);
  });

  it('ConfigNotFoundError keeps the tried paths', () => {
    const err = new ConfigNotFoundError('nope', [
      '/a/tako.config.ts',
      '/tako.config.ts',
    ]);
    expect(err.triedPaths).toHaveLength(2);
  });
});
