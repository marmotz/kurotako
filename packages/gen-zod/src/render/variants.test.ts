import type { Field } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { entityOf } from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { filterClass, variantFields } from './variants.js';

const User = entityOf(blogSource(), 'User');
const names = (v: Parameters<typeof variantFields>[1]) =>
  variantFields(User, v).map((s) => s.field.name);

describe('variantFields', () => {
  it('full: every field, optionality from the IR', () => {
    expect(names('full')).toEqual([
      'id',
      'email',
      'name',
      'age',
      'role',
      'createdAt',
    ]);
    const sel = variantFields(User, 'full');
    expect(sel.find((s) => s.field.name === 'name')?.optional).toBe(true);
    expect(sel.find((s) => s.field.name === 'email')?.optional).toBe(false);
  });

  it('create: drops the expr-default primary key, optionality via isCreateOptional', () => {
    expect(names('create')).toEqual([
      'email',
      'name',
      'age',
      'role',
      'createdAt',
    ]);
    const sel = variantFields(User, 'create');
    // role has a literal default -> optional
    expect(sel.find((s) => s.field.name === 'role')?.optional).toBe(true);
    expect(sel.find((s) => s.field.name === 'email')?.optional).toBe(false);
  });

  it('update: full set minus the primary key', () => {
    expect(names('update')).toEqual([
      'email',
      'name',
      'age',
      'role',
      'createdAt',
    ]);
    expect(variantFields(User, 'update').every((s) => s.optional)).toBe(true);
  });
});

describe('filterClass', () => {
  const f = (t: Field['type']): Field => ({
    name: 'x',
    type: t,
    list: false,
    optional: false,
    nullable: false,
    constraints: {},
  });
  it('scalar mapping', () => {
    expect(filterClass(f({ kind: 'scalar', scalar: 'string' }))).toBe(
      'StringFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'uuid' }))).toBe(
      'StringFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'int' }))).toBe('IntFilter');
    expect(filterClass(f({ kind: 'scalar', scalar: 'float' }))).toBe(
      'FloatFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'bigint' }))).toBe(
      'BigIntFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'boolean' }))).toBe(
      'BoolFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'datetime' }))).toBe(
      'DateTimeFilter',
    );
    expect(filterClass(f({ kind: 'scalar', scalar: 'json' }))).toBeNull();
  });
  it('enum -> Enum<Name>Filter, unknown -> null', () => {
    expect(filterClass(f({ kind: 'enum', ref: 'Role' }))).toBe(
      'EnumRoleFilter',
    );
    expect(filterClass(f({ kind: 'unknown' }))).toBeNull();
  });
});
