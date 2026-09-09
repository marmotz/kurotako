/** Shared IR fixtures for gen-typescript tests. */
import {
  createSourceIR,
  type IR,
  IR_VERSION,
  type SourceIR,
} from '@kurotako/ir';

export function irOf(...sources: SourceIR[]): IR {
  return {
    irVersion: IR_VERSION,
    sources: Object.fromEntries(
      sources.map((source) => [source.namespace, source]),
    ),
  };
}

/** A source that covers scalar classes, enum metadata and reciprocal relations. */
export function blogSource(): SourceIR {
  return createSourceIR({ namespace: 'blog', parser: 'test' })
    .addEnum('Role', (enumeration) => enumeration.value('ADMIN').value('USER'))
    .addEntity('User', (entity) => {
      entity.field('id', (field) =>
        field
          .scalar('uuid')
          .primary()
          .default({ kind: 'expr', expr: 'uuid()' }),
      );
      entity.field('email', (field) =>
        field
          .scalar('string')
          .doc('Primary email')
          .format('email')
          .minLength(3)
          .maxLength(255)
          .regex('^[^@]+@[^@]+$')
          .unique(),
      );
      entity.field('role', (field) =>
        field.enum('Role').default({ kind: 'value', value: 'USER' }),
      );
      entity.field('meta', (field) => field.scalar('json').optional());
      entity.field('mystery', (field) => field.unknown('provider payload'));
      entity.relation('posts', (relation) =>
        relation.to('blog', 'Post').many().backRelation('author'),
      );
    })
    .addEntity('Post', (entity) => {
      entity.field('id', (field) => field.scalar('int').primary());
      entity.field('authorId', (field) => field.scalar('uuid'));
      entity.field('published', (field) =>
        field.scalar('boolean').default({ kind: 'value', value: false }),
      );
      entity.relation('author', (relation) =>
        relation
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
