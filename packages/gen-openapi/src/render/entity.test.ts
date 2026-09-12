import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it, vi } from 'vitest';
import { blogSource } from '../testing/ir.js';
import { renderEntity, renderTypeAlias } from './entity.js';

function entityOf(source: ReturnType<typeof blogSource>, name: string) {
  const e = source.entities[name];
  if (e === undefined) {
    throw new Error(`fixture has no entity '${name}'`);
  }
  return e;
}

describe('renderEntity — own fields', () => {
  it('renders fields, required and relations for User', () => {
    const source = blogSource();
    const schema = renderEntity(entityOf(source, 'User'), {
      openapiVersion: '3.1',
      namespace: 'blog',
    });
    expect(schema.type).toBe('object');
    expect(schema.properties).toMatchObject({
      id: { type: 'string', format: 'uuid' },
      email: { type: 'string', format: 'email', maxLength: 255 },
      role: { $ref: '#/components/schemas/Role' },
      posts: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
    });
    // `name` and `age` are optional -> excluded from `required`.
    expect(schema.required).toEqual(['id', 'email', 'role', 'createdAt']);
  });

  it('renders a to-one relation as a bare $ref', () => {
    const source = blogSource();
    const schema = renderEntity(entityOf(source, 'Post'), {
      openapiVersion: '3.1',
      namespace: 'blog',
    });
    expect(schema.properties).toMatchObject({
      author: { $ref: '#/components/schemas/User' },
    });
  });

  it('wraps an optional to-one relation nullable', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Customer', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
      })
      .addEntity('Order', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
        e.relation('customer', (r) =>
          r.to('shop', 'Customer').one().optional(),
        );
      })
      .build();
    const schema = renderEntity(entityOf(source, 'Order'), {
      openapiVersion: '3.1',
      namespace: 'shop',
    });
    expect(schema.properties).toMatchObject({
      customer: {
        oneOf: [{ $ref: '#/components/schemas/Customer' }, { type: 'null' }],
      },
    });
  });

  it('does not require an entity with no required fields', () => {
    const source = createSourceIR({ namespace: 'ns', parser: 'test' })
      .addEntity('Empty', (e) => {
        e.field('note', (f) => f.scalar('string').optional());
      })
      .build();
    const schema = renderEntity(entityOf(source, 'Empty'), {
      openapiVersion: '3.1',
      namespace: 'ns',
    });
    expect(schema.required).toBeUndefined();
  });

  it('renders additionalProperties when set on the entity', () => {
    const source = createSourceIR({ namespace: 'ns', parser: 'test' })
      .addEntity('Bag', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
        e.additionalProperties((v) => v.scalar('string'));
      })
      .build();
    const schema = renderEntity(entityOf(source, 'Bag'), {
      openapiVersion: '3.1',
      namespace: 'ns',
    });
    expect(schema.additionalProperties).toEqual({ type: 'string' });
  });

  it('cross-source relation is omitted and logged at debug', () => {
    const debug = vi.fn();
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Order', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
        e.field('customerId', (f) => f.scalar('uuid'));
        e.relation('customer', (r) => r.to('crm', 'Customer').one().owning());
      })
      .build();
    const schema = renderEntity(entityOf(source, 'Order'), {
      openapiVersion: '3.1',
      namespace: 'shop',
      logger: { debug, info() {}, warn() {}, error() {} },
    });
    expect(schema.properties).not.toHaveProperty('customer');
    expect(debug).toHaveBeenCalled();
  });

  it('a self-referential (circular) relation renders a plain $ref with no special handling', () => {
    const source = createSourceIR({ namespace: 'ns', parser: 'test' })
      .addEntity('Node', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
        e.relation('parent', (r) => r.to('ns', 'Node').one().optional());
      })
      .build();
    const schema = renderEntity(entityOf(source, 'Node'), {
      openapiVersion: '3.1',
      namespace: 'ns',
    });
    expect(schema.properties).toMatchObject({
      parent: {
        oneOf: [{ $ref: '#/components/schemas/Node' }, { type: 'null' }],
      },
    });
  });
});

describe('renderTypeAlias', () => {
  it('renders a union alias', () => {
    const alias = {
      name: 'Scalar',
      type: {
        kind: 'union' as const,
        variants: [
          { kind: 'scalar' as const, scalar: 'string' as const },
          { kind: 'scalar' as const, scalar: 'int' as const },
        ],
      },
    };
    expect(renderTypeAlias(alias)).toEqual({
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    });
  });

  it('adds description from doc', () => {
    const alias = {
      name: 'Scalar',
      type: { kind: 'scalar' as const, scalar: 'string' as const },
      doc: 'a string',
    };
    expect(renderTypeAlias(alias)).toEqual({
      type: 'string',
      description: 'a string',
    });
  });
});
