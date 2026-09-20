import { describe, expect, it } from 'vitest';
import {
  MissingZodDependencyError,
  MissingZodSymbolError,
  ReactTanstackGenError,
  UnknownIncludeEntityError,
} from './errors.js';

describe('errors', () => {
  it('ReactTanstackGenError carries a stable code and its class name', () => {
    const error = new ReactTanstackGenError('some_code', 'boom');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('some_code');
    expect(error.name).toBe('ReactTanstackGenError');
  });

  it('MissingZodDependencyError', () => {
    const error = new MissingZodDependencyError();
    expect(error).toBeInstanceOf(ReactTanstackGenError);
    expect(error.code).toBe('react_tanstack_missing_zod_dependency');
    expect(error.name).toBe('MissingZodDependencyError');
  });

  it('MissingZodSymbolError names the entity key and the role', () => {
    const error = new MissingZodSymbolError('api.LoginDto', 'createSchema');
    expect(error.code).toBe('react_tanstack_missing_zod_symbol');
    expect(error.entityKey).toBe('api.LoginDto');
    expect(error.role).toBe('createSchema');
    expect(error.message).toContain("'api.LoginDto'");
    expect(error.message).toContain("'createSchema'");
  });

  it('UnknownIncludeEntityError names the entity', () => {
    const error = new UnknownIncludeEntityError('Typo');
    expect(error.code).toBe('react_tanstack_unknown_include_entity');
    expect(error.entity).toBe('Typo');
    expect(error.message).toContain("'Typo'");
  });
});
