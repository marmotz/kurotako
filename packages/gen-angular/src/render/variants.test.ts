import { createFields, updateFields } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { entityOf } from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { variantFields } from './variants.js';

describe('variantFields', () => {
  const source = blogSource();
  const user = entityOf(source, 'User');

  it('Create equals the IR createFields helper', () => {
    expect(variantFields(user, 'Create')).toEqual(createFields(user));
  });

  it('Update equals the IR updateFields helper', () => {
    expect(variantFields(user, 'Update')).toEqual(updateFields(user));
  });

  it('Create drops the expr-default primary key', () => {
    const names = variantFields(user, 'Create').map((f) => f.name);
    expect(names).not.toContain('id');
  });

  it('Update omits the primary key', () => {
    const names = variantFields(user, 'Update').map((f) => f.name);
    expect(names).not.toContain('id');
    expect(names).toContain('email');
  });
});
