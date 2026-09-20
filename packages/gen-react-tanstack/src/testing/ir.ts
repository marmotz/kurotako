/**
 * Fixture IR builders for the gen-react-tanstack tests. Not part of the published
 * surface.
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
 * A `blog` source: enum `Role`, `User` (scalar mix, a nullable date, a list, one
 * to-many relation to `Post`) and `Post` (one to-one relation back to `User`).
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
      t.field('nickname', (f) => f.enum('Role'));
      t.field('createdAt', (f) =>
        f.scalar('datetime').default({ kind: 'expr', expr: 'now()' }),
      );
      t.field('archivedAt', (f) => f.scalar('datetime').nullable());
      t.field('tags', (f) => f.scalar('string').list());
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
 * An `api` source shaped like OpenAPI request bodies: `LoginDto`, `RegisterDto`
 * (both plain scalars), no relations.
 */
export function apiSource(): SourceIR {
  return createSourceIR({ namespace: 'api', parser: 'test' })
    .addEntity('LoginDto', (t) => {
      t.field('email', (f) => f.scalar('string').format('email'));
      t.field('password', (f) => f.scalar('string').minLength(8));
    })
    .addEntity('RegisterDto', (t) => {
      t.field('email', (f) => f.scalar('string').format('email'));
      t.field('password', (f) => f.scalar('string').minLength(8));
      t.field('birthday', (f) => f.scalar('date').optional());
    })
    .build();
}

/**
 * A `shop` source exercising the degrade paths: `Category` takes part in a `ref`
 * cycle (`parent`), `Product` has a to-one relation to it plus a to-one relation
 * to `Brand`, and `Product` also carries a union and a ref field.
 */
export function shopSource(): SourceIR {
  return createSourceIR({ namespace: 'shop', parser: 'test' })
    .addEntity('Brand', (t) => {
      t.field('id', (f) =>
        f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('name', (f) => f.scalar('string'));
    })
    .addEntity('Category', (t) => {
      t.field('id', (f) =>
        f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('label', (f) => f.scalar('string'));
      t.field('parent', (f) => f.ref('Category').optional());
    })
    .addEntity('Product', (t) => {
      t.field('id', (f) =>
        f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
      );
      t.field('sku', (f) => f.scalar('string'));
      t.field('brandId', (f) => f.scalar('uuid'));
      t.field('categoryId', (f) => f.scalar('uuid'));
      t.field('note', (f) => f.union((u) => u.scalar('string').scalar('int')));
      t.field('meta', (f) => f.scalar('json'));
      t.relation('brand', (r) =>
        r
          .to('shop', 'Brand')
          .one()
          .owning()
          .fkFields('brandId')
          .references('id'),
      );
      t.relation('category', (r) =>
        r
          .to('shop', 'Category')
          .one()
          .owning()
          .fkFields('categoryId')
          .references('id'),
      );
      t.relation('owner', (r) => r.to('other', 'Owner').one().optional());
    })
    .build();
}

/**
 * A `checkout` source with acyclic relations: `Order` has a to-one `customer` and a
 * to-many `lines`, neither pointing back. The shape a request body nests.
 */
export function checkoutSource(): SourceIR {
  return createSourceIR({ namespace: 'checkout', parser: 'test' })
    .addEntity('Customer', (t) => {
      t.field('name', (f) => f.scalar('string').minLength(2));
    })
    .addEntity('OrderLine', (t) => {
      t.field('sku', (f) => f.scalar('string').minLength(2));
      t.field('qty', (f) => f.scalar('int').min(1));
    })
    .addEntity('Order', (t) => {
      t.field('number', (f) => f.scalar('string').minLength(3));
      t.relation('customer', (r) => r.to('checkout', 'Customer').one());
      t.relation('lines', (r) => r.to('checkout', 'OrderLine').many());
    })
    .build();
}
