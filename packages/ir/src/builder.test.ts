import { describe, expect, it } from 'vitest';
import { createSourceIR, IrBuildError } from './builder.js';
import type { ScalarType, SourceIR } from './types.js';

describe('createSourceIR — happy path', () => {
  it('builds and deep-equals the expected SourceIR', () => {
    const built = createSourceIR({ namespace: 'pg', parser: 'prisma' })
      .addEnum('Role', (e) =>
        e.value('USER').value('ADMIN', { dbName: 'admin' }),
      )
      .addEntity('User', (e) => {
        e.field('id', (f) =>
          f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
        );
        e.field('email', (f) => f.scalar('string').format('email').unique());
        e.field('role', (f) =>
          f.enum('Role').default({ kind: 'value', value: 'USER' }),
        );
        e.relation('posts', (r) =>
          r.to('pg', 'Post').many().backRelation('author'),
        );
      })
      .addEntity('Post', (e) => {
        e.field('id', (f) => f.scalar('uuid').primary());
        e.field('authorId', (f) => f.scalar('uuid'));
        e.relation('author', (r) =>
          r
            .to('pg', 'User')
            .one()
            .owning()
            .backRelation('posts')
            .fkFields('authorId')
            .references('id'),
        );
      })
      .build();

    const expected: SourceIR = {
      namespace: 'pg',
      parser: 'prisma',
      entities: {
        User: {
          name: 'User',
          fields: [
            {
              name: 'id',
              type: { kind: 'scalar', scalar: 'uuid' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
              default: { kind: 'expr', expr: 'uuid()' },
            },
            {
              name: 'email',
              type: { kind: 'scalar', scalar: 'string' },
              list: false,
              optional: false,
              nullable: false,
              constraints: { format: 'email', unique: true },
            },
            {
              name: 'role',
              type: { kind: 'enum', ref: 'Role' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
              default: { kind: 'value', value: 'USER' },
            },
          ],
          relations: [
            {
              name: 'posts',
              target: { namespace: 'pg', entity: 'Post' },
              cardinality: 'many',
              optional: false,
              owning: false,
              backRelation: 'author',
            },
          ],
          indexes: [],
          uniques: [],
          primaryKey: ['id'],
        },
        Post: {
          name: 'Post',
          fields: [
            {
              name: 'id',
              type: { kind: 'scalar', scalar: 'uuid' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
            },
            {
              name: 'authorId',
              type: { kind: 'scalar', scalar: 'uuid' },
              list: false,
              optional: false,
              nullable: false,
              constraints: {},
            },
          ],
          relations: [
            {
              name: 'author',
              target: { namespace: 'pg', entity: 'User' },
              cardinality: 'one',
              optional: false,
              owning: true,
              backRelation: 'posts',
              fkFields: ['authorId'],
              references: ['id'],
            },
          ],
          indexes: [],
          uniques: [],
          primaryKey: ['id'],
        },
      },
      enums: {
        Role: {
          name: 'Role',
          values: [{ name: 'USER' }, { name: 'ADMIN', dbName: 'admin' }],
        },
      },
    };

    expect(built).toEqual(expected);
  });
});

describe('createSourceIR — incremental throws', () => {
  const base = () => createSourceIR({ namespace: 'pg', parser: 'prisma' });

  it('duplicate field name', () => {
    expect(() =>
      base().addEntity('User', (e) => {
        e.field('id', (f) => f.scalar('uuid'));
        e.field('id', (f) => f.scalar('int'));
      }),
    ).toThrow(IrBuildError);
  });

  it('format() on a non-string type', () => {
    expect(() =>
      base().addEntity('User', (e) => {
        e.field('age', (f) => f.scalar('int').format('email'));
      }),
    ).toThrow(/string scalar/);
  });

  it('primary() on a list field', () => {
    expect(() =>
      base().addEntity('User', (e) => {
        e.field('tags', (f) => f.scalar('string').list().primary());
      }),
    ).toThrow(/list field/);
  });

  it('unknown ScalarType', () => {
    expect(() =>
      base().addEntity('User', (e) => {
        e.field('x', (f) => f.scalar('text' as ScalarType));
      }),
    ).toThrow(/unknown scalar/);
  });
});

describe('createSourceIR — build() gate', () => {
  it('surfaces a downstream assertSourceIR failure with a located path', () => {
    try {
      createSourceIR({ namespace: 'pg', parser: 'prisma' })
        .addEntity('User', (e) => {
          e.field('id', (f) => f.scalar('uuid').primary());
          e.relation('posts', (r) =>
            r.to('pg', 'Post').many().backRelation('author'),
          );
        })
        .build();
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(IrBuildError);
      expect((err as IrBuildError).path).toBe('pg.User.relations.posts');
    }
  });
});
