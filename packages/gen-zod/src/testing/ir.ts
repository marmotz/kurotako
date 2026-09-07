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

/**
 * A `geo` source exercising the union-type surface: a plain scalar union alias
 * (`Scalar`), a discriminated-union alias over two entities (`Shape`), and a
 * `ref` cycle `Shape -> Group -> child: Shape` — recursion that resolves
 * through an entity object, the realistic shape of a recursive union.
 */
export function geoSource(): SourceIR {
  return createSourceIR({ namespace: 'geo', parser: 'test' })
    .addTypeAlias('Scalar', (t) =>
      t
        .doc('a string or an int')
        .union((u) => u.scalar('string').scalar('int')),
    )
    .addTypeAlias('Shape', (t) =>
      t.union((u) => u.ref('Circle').ref('Group').discriminator('kind')),
    )
    .addEntity('Circle', (e) => {
      e.field('id', (f) => f.scalar('int').primary());
      e.field('kind', (f) => f.scalar('string'));
      e.field('radius', (f) => f.scalar('int'));
    })
    .addEntity('Group', (e) => {
      e.field('id', (f) => f.scalar('int').primary());
      e.field('kind', (f) => f.scalar('string'));
      // Recursive `ref` back to the `Shape` alias.
      e.field('child', (f) => f.ref('Shape'));
    })
    .build();
}
