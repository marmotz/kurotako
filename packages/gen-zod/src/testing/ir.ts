/**
 * Fixture IR builders for the gen-zod tests. Not part of the published surface.
 */
import {
  createSourceIR,
  type IR,
  IR_VERSION,
  type SourceIR,
} from '@kurotako/ir';

/** Wrap one or more `SourceIR` into an `IR`, keyed by namespace. */
export function irOf(...sources: SourceIR[]): IR {
  return {
    irVersion: IR_VERSION,
    sources: Object.fromEntries(sources.map((s) => [s.namespace, s])),
  };
}

/**
 * A `blog` source: enum `Role`, `User` (scalar mix, one to-many relation to
 * `Post`) and `Post` (one to-one relation back to `User`).
 */
export function blogSource(): SourceIR {
  return createSourceIR({ namespace: 'blog', parser: 'test' })
    .addEnum('Role', (e) => e.value('ADMIN').value('USER'))
    .addEntity('User', (t) => {
      t.field('id', (f) =>
        f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('email', (f) =>
        f.scalar('string').format('email').maxLength(255),
      );
      t.field('name', (f) => f.scalar('string').optional());
      t.field('age', (f) => f.scalar('int').min(0).max(150).optional());
      t.field('role', (f) =>
        f.enum('Role').default({ kind: 'value', value: 'USER' }),
      );
      t.field('createdAt', (f) =>
        f.scalar('datetime').default({ kind: 'expr', expr: 'now()' }),
      );
      t.relation('posts', (r) =>
        r.to('blog', 'Post').many().backRelation('author'),
      );
    })
    .addEntity('Post', (t) => {
      t.field('id', (f) =>
        f
          .scalar('int')
          .primary()
          .default({ kind: 'expr', expr: 'autoincrement()' }),
      );
      t.field('title', (f) => f.scalar('string'));
      t.field('published', (f) =>
        f.scalar('boolean').default({ kind: 'value', value: false }),
      );
      t.field('authorId', (f) => f.scalar('uuid'));
      t.relation('author', (r) =>
        r
          .to('blog', 'User')
          .one()
          .owning()
          .fkFields('authorId')
          .references('id')
          .backRelation('posts'),
      );
    })
    .build();
}
