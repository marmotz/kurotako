import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import { entityOf } from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { deepRelations } from './relations.js';

describe('deepRelations', () => {
  const source = blogSource();
  const user = entityOf(source, 'User');
  const post = entityOf(source, 'Post');

  it('to-many relation -> FormArray<FormGroup<...>>, starts empty (many: true)', () => {
    const [rel] = deepRelations(user, 'Create', 'blog');
    expect(rel).toBeDefined();
    expect(rel?.many).toBe(true);
    expect(rel?.entry.fullType).toBe(
      'FormArray<FormGroup<PostCreateDeepFormControls>>',
    );
  });

  it('to-one relation -> nested FormGroup<...>', () => {
    const [rel] = deepRelations(post, 'Update', 'blog');
    expect(rel).toBeDefined();
    expect(rel?.many).toBe(false);
    expect(rel?.entry.fullType).toBe('FormGroup<UserUpdateDeepFormControls>');
  });

  it('emits a variant-suffixed add<Relation><Variant> builder method name', () => {
    const [rel] = deepRelations(user, 'Create', 'blog');
    expect(rel?.builderMethod).toBe('addPostsCreate');
  });

  it('cross-source relation degrades to flat + debug log', () => {
    const local = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Order', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.field('customerId', (f) => f.scalar('uuid'));
        t.relation('customer', (r) => r.to('crm', 'Customer').one().owning());
      })
      .build();
    const order = entityOf(local, 'Order');
    const debug = vi.fn();
    const relations = deepRelations(order, 'Create', 'shop', {
      debug,
      info() {},
      warn() {},
      error() {},
    });
    expect(relations).toHaveLength(0);
    expect(debug).toHaveBeenCalled();
  });
});
