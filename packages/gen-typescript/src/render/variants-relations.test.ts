import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import {
  entityOf,
  fieldOf,
  noopLogger,
  relationOf,
} from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { relationMember } from './relations.js';
import { filterClass, variantFields } from './variants.js';

describe('variantFields', () => {
  it('delegates create/update selection and optionality to the IR helpers', () => {
    const user = entityOf(blogSource(), 'User');
    expect(
      variantFields(user, 'create').map(({ field }) => field.name),
    ).not.toContain('id');
    expect(
      variantFields(user, 'create').find(({ field }) => field.name === 'role')
        ?.optional,
    ).toBe(true);
    expect(
      variantFields(user, 'update').map(({ field }) => field.name),
    ).not.toContain('id');
    expect(
      variantFields(user, 'update').every(({ optional }) => optional),
    ).toBe(true);
  });

  it('selects filters only for direct scalar and enum fields', () => {
    const user = entityOf(blogSource(), 'User');
    expect(filterClass(fieldOf(user, 1))).toBe('StringFilter');
    expect(filterClass(fieldOf(user, 2))).toBe('EnumRoleFilter');
    expect(filterClass(fieldOf(user, 3))).toBeNull();
    expect(filterClass(fieldOf(user, 4))).toBeNull();
  });
});

describe('relationMember', () => {
  it('renders deep one/many, where and select members', () => {
    const user = entityOf(blogSource(), 'User');
    const posts = relationOf(user, 0);
    expect(
      relationMember(posts, 'flat', 'full', { fromNamespace: 'blog' }),
    ).toBeNull();
    expect(
      relationMember(posts, 'deep', 'full', { fromNamespace: 'blog' }),
    ).toEqual({
      type: 'PostDeepDto[]',
      optional: true,
    });
    expect(
      relationMember(posts, 'deep', 'where', { fromNamespace: 'blog' }),
    ).toEqual({
      type: '{ some?: PostWhereDeepDto; every?: PostWhereDeepDto; none?: PostWhereDeepDto }',
      optional: true,
    });
    expect(
      relationMember(posts, 'deep', 'select', { fromNamespace: 'blog' }),
    ).toEqual({
      type: 'boolean | PostSelectDeepDto',
      optional: true,
    });
  });

  it('degrades cross-source deep relations and logs the policy', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Order', (entity) => {
        entity.relation('customer', (relation) =>
          relation.to('crm', 'Customer').one(),
        );
      })
      .build();
    const relation = relationOf(entityOf(source, 'Order'), 0);
    const debug = vi.fn();
    expect(
      relationMember(relation, 'deep', 'full', {
        fromNamespace: 'shop',
        logger: { ...noopLogger, debug },
      }),
    ).toBeNull();
    expect(debug).toHaveBeenCalledWith(
      expect.stringContaining('degrading to the FK id'),
    );
  });
});
