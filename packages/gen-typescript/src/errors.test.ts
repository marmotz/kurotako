import { describe, expect, it } from 'vitest';
import {
  TypeScriptAliasCycleError,
  TypeScriptAliasPublicNameCollisionError,
  TypeScriptEnumCollisionError,
  TypeScriptEnumPublicNameCollisionError,
  TypeScriptGenError,
} from './errors.js';

describe('TypeScriptGenError', () => {
  it('retains its stable code and cause', () => {
    const cause = new Error('source failure');
    const error = new TypeScriptGenError('typescript_test', 'test failure', {
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TypeScriptGenError');
    expect(error.code).toBe('typescript_test');
    expect(error.cause).toBe(cause);
  });
});

describe('TypeScriptAliasCycleError', () => {
  it('uses a stable code and sorted alias names', () => {
    const error = new TypeScriptAliasCycleError('shop', ['Right', 'Left']);

    expect(error).toBeInstanceOf(TypeScriptGenError);
    expect(error.name).toBe('TypeScriptAliasCycleError');
    expect(error.code).toBe('typescript_alias_cycle');
    expect(error.namespace).toBe('shop');
    expect(error.aliasNames).toEqual(['Left', 'Right']);
    expect(error.message).toBe(
      "source type aliases 'Left', 'Right' form a direct reference cycle in namespace 'shop'; pure TypeScript aliases cannot represent it",
    );
  });
});

describe('TypeScriptAliasPublicNameCollisionError', () => {
  it('uses a stable code and sorted colliding names', () => {
    const error = new TypeScriptAliasPublicNameCollisionError('shop', [
      'UserDto',
      'Role',
    ]);

    expect(error).toBeInstanceOf(TypeScriptGenError);
    expect(error.name).toBe('TypeScriptAliasPublicNameCollisionError');
    expect(error.code).toBe('typescript_alias_public_name_collision');
    expect(error.namespace).toBe('shop');
    expect(error.names).toEqual(['Role', 'UserDto']);
    expect(error.message).toBe(
      "source type aliases 'Role', 'UserDto' collide with generated public identifiers in namespace 'shop'; rename one of the conflicting source definitions",
    );
  });
});

describe('TypeScriptEnumPublicNameCollisionError', () => {
  it('uses a stable code and sorted colliding names', () => {
    const error = new TypeScriptEnumPublicNameCollisionError('shop', [
      'UserDto',
      'JsonValue',
    ]);

    expect(error).toBeInstanceOf(TypeScriptGenError);
    expect(error.name).toBe('TypeScriptEnumPublicNameCollisionError');
    expect(error.code).toBe('typescript_enum_public_name_collision');
    expect(error.namespace).toBe('shop');
    expect(error.names).toEqual(['JsonValue', 'UserDto']);
    expect(error.message).toBe(
      "source enums 'JsonValue', 'UserDto' collide with other public identifiers in namespace 'shop'; rename one of the conflicting source definitions",
    );
  });
});

describe('TypeScriptEnumCollisionError', () => {
  it('uses a stable code and retains both enum origins', () => {
    const error = new TypeScriptEnumCollisionError(
      'Role',
      'source-level',
      "entity 'User'",
    );

    expect(error).toBeInstanceOf(TypeScriptGenError);
    expect(error.name).toBe('TypeScriptEnumCollisionError');
    expect(error.code).toBe('typescript_enum_collision');
    expect(error.enumName).toBe('Role');
    expect(error.firstOrigin).toBe('source-level');
    expect(error.secondOrigin).toBe("entity 'User'");
    expect(error.message).toContain("source-level vs entity 'User'");
  });
});
