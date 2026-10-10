/**
 * Fixture for the date-type and Read-variant tests (`optional()` on a defaulted
 * field mirrors what the Prisma parser does): one entity covering a
 * timestamp with a db default, an optional timestamp without default, a date, a
 * time of day and a hidden field, plus a to-many relation to a second entity.
 */
import { createSourceIR, type SourceIR } from '@kurotako/ir';

export function accountSource(): SourceIR {
  return createSourceIR({ namespace: 'acc', parser: 'test' })
    .addEntity('User', (t) => {
      t.field('id', (f) =>
        f
          .scalar('uuid')
          .primary()
          .optional()
          .default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('email', (f) => f.scalar('string'));
      t.field('passwordHash', (f) => f.scalar('string').hidden());
      t.field('createdAt', (f) =>
        f
          .scalar('datetime')
          .optional()
          .default({ kind: 'expr', expr: 'now()' }),
      );
      t.field('seenAt', (f) => f.scalar('datetime').optional());
      t.field('birthday', (f) => f.scalar('date').nullable());
      t.field('wakeAt', (f) => f.scalar('datetime').format('time').optional());
      t.relation('posts', (r) =>
        r.to('acc', 'Post').many().backRelation('author'),
      );
    })
    .addEntity('Post', (t) => {
      t.field('id', (f) =>
        f
          .scalar('uuid')
          .primary()
          .optional()
          .default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('title', (f) => f.scalar('string'));
      t.field('authorId', (f) => f.scalar('uuid'));
      t.relation('author', (r) =>
        r
          .to('acc', 'User')
          .one()
          .owning()
          .fkFields('authorId')
          .references('id')
          .backRelation('posts'),
      );
    })
    .build();
}
