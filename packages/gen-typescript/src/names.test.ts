import { describe, expect, it } from 'vitest';
import {
  barrelModule,
  entityModule,
  enumConst,
  enumsModule,
  enumTypeName,
  FAMILIES,
  FAMILY_TOKEN,
  type Family,
  filtersModule,
  scalarsModule,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type Variant,
} from './names.js';

describe('typeName — full variant x family matrix', () => {
  const cases: Array<[Variant, Family, string]> = [
    ['', '', 'UserDto'],
    ['', 'Deep', 'UserDeepDto'],
    ['Create', '', 'UserCreateDto'],
    ['Create', 'Deep', 'UserCreateDeepDto'],
    ['Update', '', 'UserUpdateDto'],
    ['Update', 'Deep', 'UserUpdateDeepDto'],
    ['Where', '', 'UserWhereDto'],
    ['Where', 'Deep', 'UserWhereDeepDto'],
    ['Select', '', 'UserSelectDto'],
    ['Select', 'Deep', 'UserSelectDeepDto'],
  ];

  for (const [variant, family, expected] of cases) {
    it(`${variant || 'full'}/${family || 'flat'}`, () => {
      expect(typeName('User', variant, family)).toBe(expected);
    });
  }
});

describe('name constants and module helpers', () => {
  it('preserves the fixed variant and family mappings', () => {
    expect(VARIANTS).toEqual(['full', 'create', 'update', 'where', 'select']);
    expect(FAMILIES).toEqual(['flat', 'deep']);
    expect(VARIANT_TOKEN).toEqual({
      full: '',
      create: 'Create',
      update: 'Update',
      where: 'Where',
      select: 'Select',
    });
    expect(FAMILY_TOKEN).toEqual({ flat: '', deep: 'Deep' });
  });

  it('keeps enum identifiers verbatim', () => {
    expect(enumConst('Role')).toBe('Role');
    expect(enumTypeName('Role')).toBe('Role');
  });

  it('uses the typescript output sub-tree in every module specifier', () => {
    expect(entityModule('blog', 'User')).toBe('blog/typescript/User.type');
    expect(enumsModule('blog')).toBe('blog/typescript/enums');
    expect(filtersModule('blog')).toBe('blog/typescript/filters');
    expect(scalarsModule('blog')).toBe('blog/typescript/scalars');
    expect(barrelModule('blog')).toBe('blog/typescript');
  });
});
