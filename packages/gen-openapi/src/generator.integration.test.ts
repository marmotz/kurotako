/**
 * Assembles a `SourceIR` covering every `FieldType` kind + relations + a
 * discriminated union, generates the document, and asserts it resolves
 * cleanly via `@apidevtools/json-schema-ref-parser` — the same dependency
 * `parser-openapi` already uses to read a document, here validating `$ref`
 * resolvability of the emitted one end to end. Not a re-run of
 * `parser-openapi` itself.
 */
import { dereference } from '@apidevtools/json-schema-ref-parser';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { openapiGenerator } from './generator.js';

function fullIrSource() {
  return createSourceIR({ namespace: 'shop', parser: 'test' })
    .addEnum('Status', (e) => e.value('ACTIVE').value('INACTIVE'))
    .addTypeAlias('ProductRef', (t) => t.ref('Product'))
    .addTypeAlias('PaymentMethod', (t) =>
      t.union((u) =>
        u.ref('CardPayment').ref('CashPayment').discriminator('kind'),
      ),
    )
    .addEntity('CardPayment', (e) => {
      e.field('kind', (f) => f.scalar('string'));
      e.field('last4', (f) => f.scalar('string'));
    })
    .addEntity('CashPayment', (e) => {
      e.field('kind', (f) => f.scalar('string'));
    })
    .addEntity('Customer', (e) => {
      e.field('id', (f) => f.scalar('uuid').primary());
    })
    .addEntity('Product', (e) => {
      e.field('id', (f) => f.scalar('int').primary());
      e.field('name', (f) => f.scalar('string').maxLength(100));
      e.field('price', (f) => f.scalar('float').min(0));
      e.field('big', (f) => f.scalar('bigint'));
      e.field('active', (f) => f.scalar('boolean'));
      e.field('createdAt', (f) => f.scalar('datetime'));
      e.field('releaseDate', (f) => f.scalar('date'));
      e.field('sku', (f) => f.scalar('uuid'));
      e.field('thumbnail', (f) => f.scalar('bytes'));
      e.field('metadata', (f) => f.scalar('json'));
      e.field('status', (f) => f.enum('Status'));
      e.field('tags', (f) => f.array((el) => el.scalar('string')));
      e.field('attributes', (f) => f.map((v) => v.scalar('string')));
      e.field('anything', (f) => f.unknown('object'));
      e.field('nickname', (f) => f.scalar('string').optional());
      e.field('note', (f) => f.scalar('string').nullable());
      e.field('payment', (f) => f.ref('PaymentMethod'));
    })
    .addEntity('Order', (e) => {
      e.field('id', (f) => f.scalar('int').primary());
      e.relation('customer', (r) => r.to('shop', 'Customer').one().owning());
      e.relation('products', (r) => r.to('shop', 'Product').many());
    })
    .build();
}

describe('openapiGenerator — integration', () => {
  it.each(['3.0', '3.1'] as const)(
    'emits a %s document that dereferences cleanly',
    async (openapiVersion) => {
      const out = openapiGenerator.generate(
        {
          ir: {
            irVersion: '4',
            sources: { shop: fullIrSource() },
          },
          dependencies: {},
          cycles: new Set(),
          logger: { debug() {}, info() {}, warn() {}, error() {} },
        },
        { openapiVersion, format: 'json', version: '1.0.0' },
      );
      if (out instanceof Promise) {
        throw new Error('openapiGenerator.generate must be synchronous');
      }
      const document = JSON.parse(out.files[0]?.content ?? '{}');
      await expect(dereference(document)).resolves.toBeDefined();
    },
  );
});
