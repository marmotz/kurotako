import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import { fileEndingWith, runGenerator } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

describe('zodGenerator.generate', () => {
  it('emits enums.ts, filters.ts, one file per entity and index.ts, all zod/-prefixed', () => {
    const out = runGenerator(irOf(blogSource()), { zodVersion: 4 });
    expect(out.files.map((f) => f.path)).toEqual([
      'blog/zod/enums.ts',
      'blog/zod/filters.ts',
      'blog/zod/User.schema.ts',
      'blog/zod/Post.schema.ts',
      'blog/zod/index.ts',
    ]);
  });

  it('zodVersion 3 vs 4 changes the leaf builders end to end', () => {
    const user4 = fileEndingWith(
      runGenerator(irOf(blogSource()), { zodVersion: 4 }).files,
      'User.schema.ts',
    );
    const user3 = fileEndingWith(
      runGenerator(irOf(blogSource()), { zodVersion: 3 }).files,
      'User.schema.ts',
    );
    expect(user4).toContain('id: z.uuid()');
    expect(user3).toContain('id: z.string().uuid()');
  });

  it('cross-source relation degrades to the FK id + debug log', () => {
    const local = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Order', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.field('customerId', (f) => f.scalar('uuid'));
        t.relation('customer', (r) => r.to('crm', 'Customer').one().owning());
      })
      .build();
    const debug = vi.fn();
    const out = runGenerator(
      irOf(local),
      { zodVersion: 4 },
      {
        ...noopLogger,
        debug,
      },
    );
    const deep = fileEndingWith(out.files, 'Order.schema.ts');
    // the full deep family drops the cross-source relation entirely
    const fullDeep = deep.slice(
      deep.indexOf('export const OrderDeepSchema'),
      deep.indexOf('export type OrderDeepDto'),
    );
    expect(fullDeep).not.toContain('customer:');
    expect(fullDeep).not.toContain('z.lazy');
    expect(debug).toHaveBeenCalled();
  });

  it('is deterministic: same IR + options -> deep-equal GenOutput', () => {
    const a = runGenerator(irOf(blogSource()), { zodVersion: 4 });
    const b = runGenerator(irOf(blogSource()), { zodVersion: 4 });
    expect(a).toEqual(b);
  });

  it('preserves IR entity + field order', () => {
    const user = fileEndingWith(
      runGenerator(irOf(blogSource()), { zodVersion: 4 }).files,
      'User.schema.ts',
    );
    const full = user.slice(
      user.indexOf('export const UserSchema'),
      user.indexOf('export type UserDto'),
    );
    const order = ['id', 'email', 'name', 'age', 'role', 'createdAt'].map((n) =>
      full.indexOf(`${n}:`),
    );
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });
});
