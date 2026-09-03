import { describe, expect, it } from 'vitest';
import {
  DependencyCycleError,
  DriverError,
  DuplicateNamespaceError,
  HookError,
  InvalidDependencyError,
  InvalidOutputPathError,
  IrValidationError,
  NamespaceMismatchError,
  OutputCollisionError,
  OutputPeerConflictError,
  PackageBuildError,
  PackageInstallError,
  TakoError,
  UnknownDependencyError,
  UnsupportedOutputModeError,
} from './errors.js';

describe('errors', () => {
  it('every subclass is a TakoError with a stable code', () => {
    const cases: [TakoError, string][] = [
      [new NamespaceMismatchError('pg', 'sqlite'), 'namespace_mismatch'],
      [new IrValidationError([], 'pg'), 'ir_invalid'],
      [new DuplicateNamespaceError('pg'), 'duplicate_namespace'],
      [new UnknownDependencyError('angular', 'zod'), 'unknown_dependency'],
      [new InvalidDependencyError('angular', 'zod'), 'invalid_dependency'],
      [new DependencyCycleError(['a', 'b', 'a']), 'dependency_cycle'],
      [new OutputCollisionError('x', ['a', 'b']), 'output_collision'],
      [new InvalidOutputPathError('../x', 'a'), 'invalid_output_path'],
      [new UnsupportedOutputModeError('weird'), 'unsupported_output_mode'],
      [
        new OutputPeerConflictError('pg', 'zod', ['^3', '^4'], ['a', 'b']),
        'output_peer_conflict',
      ],
      [new PackageBuildError('pg'), 'package_build_error'],
      [new PackageInstallError('bun'), 'package_install_error'],
      [new DriverError('parser', 'prisma'), 'driver_error'],
      [new HookError('afterEmit'), 'hook_error'],
    ];
    for (const [error, code] of cases) {
      expect(error).toBeInstanceOf(TakoError);
      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(code);
      expect(error.name).toBe(error.constructor.name);
    }
  });

  it('preserves cause where set', () => {
    const cause = new Error('boom');
    expect(new DriverError('generator', 'zod', { cause }).cause).toBe(cause);
    expect(new HookError('afterEmit', { cause }).cause).toBe(cause);
    expect(new PackageBuildError('pg', { cause }).cause).toBe(cause);
    expect(new PackageInstallError('npm', { cause }).cause).toBe(cause);
  });

  it('DriverError tags role, name and namespace', () => {
    const error = new DriverError('parser', 'prisma', { namespace: 'pg' });
    expect(error.role).toBe('parser');
    expect(error.driverName).toBe('prisma');
    expect(error.namespace).toBe('pg');
  });

  it('IrValidationError carries issues and namespace', () => {
    const issues = [{ path: 'a', code: 'shape' as const, message: 'bad' }];
    const error = new IrValidationError(issues, 'pg');
    expect(error.issues).toBe(issues);
    expect(error.namespace).toBe('pg');
  });
});
