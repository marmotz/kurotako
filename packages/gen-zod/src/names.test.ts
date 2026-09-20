import { describe, expect, it } from 'vitest';
import {
  aliasModule,
  aliasSchemaName,
  aliasTypeName,
  barrelModule,
  entityModule,
  enumConst,
  enumFilterName,
  enumSchemaName,
  enumsModule,
  enumTypeName,
  type Family,
  filtersModule,
  refSchemaName,
  schemaName,
  typeName,
  type Variant,
} from './names.js';

describe('schemaName / typeName — full variant x family matrix', () => {
  const cases: Array<[Variant, Family, string, string]> = [
    ['', '', 'UserSchema', 'UserDto'],
    ['', 'Deep', 'UserDeepSchema', 'UserDeepDto'],
    ['Create', '', 'UserCreateSchema', 'UserCreateDto'],
    ['Create', 'Deep', 'UserCreateDeepSchema', 'UserCreateDeepDto'],
    ['Update', '', 'UserUpdateSchema', 'UserUpdateDto'],
    ['Update', 'Deep', 'UserUpdateDeepSchema', 'UserUpdateDeepDto'],
    ['Where', '', 'UserWhereSchema', 'UserWhereDto'],
    ['Where', 'Deep', 'UserWhereDeepSchema', 'UserWhereDeepDto'],
    ['Select', '', 'UserSelectSchema', 'UserSelectDto'],
    ['Select', 'Deep', 'UserSelectDeepSchema', 'UserSelectDeepDto'],
  ];

  for (const [variant, family, s, t] of cases) {
    it(`${variant || 'full'}/${family || 'flat'}`, () => {
      expect(schemaName('User', variant, family)).toBe(s);
      expect(typeName('User', variant, family)).toBe(t);
    });
  }
});

describe('enum + module helpers', () => {
  it('enum identifiers', () => {
    expect(enumConst('Role')).toBe('Role');
    expect(enumSchemaName('Role')).toBe('RoleSchema');
    expect(enumTypeName('Role')).toBe('Role');
    expect(enumFilterName('Role')).toBe('EnumRoleFilter');
  });

  it('module specifiers carry the sub-tree segment', () => {
    expect(entityModule('blog', 'zod', 'User')).toBe('blog/zod/User.schema');
    expect(enumsModule('blog', 'zod')).toBe('blog/zod/enums');
    expect(filtersModule('blog', 'zod')).toBe('blog/zod/filters');
    expect(aliasModule('blog', 'zod')).toBe('blog/zod/aliases');
    expect(barrelModule('blog', 'zod')).toBe('blog/zod');
  });

  it('module specifiers honor a nested segment', () => {
    expect(entityModule('blog', 'angular/zod', 'User')).toBe(
      'blog/angular/zod/User.schema',
    );
    expect(enumsModule('blog', 'angular/zod')).toBe('blog/angular/zod/enums');
    expect(filtersModule('blog', 'angular/zod')).toBe(
      'blog/angular/zod/filters',
    );
    expect(aliasModule('blog', 'angular/zod')).toBe('blog/angular/zod/aliases');
    expect(barrelModule('blog', 'angular/zod')).toBe('blog/angular/zod');
  });
});

describe('type alias helpers', () => {
  it('alias identifiers', () => {
    expect(aliasSchemaName('Shape')).toBe('ShapeSchema');
    expect(aliasTypeName('Shape')).toBe('Shape');
    expect(refSchemaName('Shape')).toBe('ShapeSchema');
  });
});
