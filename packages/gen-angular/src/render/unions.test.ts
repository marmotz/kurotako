import type { Field } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { unionSource } from '../testing/ir.js';
import { discriminatedUnion, unionType } from './unions.js';

function unionField(overrides: Partial<Field> & Pick<Field, 'type'>): Field {
  return {
    name: 'method',
    list: false,
    optional: false,
    nullable: false,
    constraints: {},
    ...overrides,
  };
}

describe('discriminatedUnion', () => {
  const source = unionSource();
  const invoice = source.entities.Invoice;
  if (invoice === undefined) {
    throw new Error('fixture has no entity Invoice');
  }

  it('recognises a discriminated union whose targets all resolve to entities', () => {
    const field = invoice.fields.find((f) => f.name === 'method');
    if (field === undefined) {
      throw new Error('no method field');
    }
    expect(discriminatedUnion(field, source)).toEqual({
      discriminator: 'kind',
      variants: [
        { value: 'card', entity: 'CardPayment' },
        { value: 'transfer', entity: 'BankTransfer' },
      ],
    });
  });

  it('returns undefined for a union with no discriminator mapping', () => {
    const field = invoice.fields.find((f) => f.name === 'ref');
    if (field === undefined) {
      throw new Error('no ref field');
    }
    expect(discriminatedUnion(field, source)).toBeUndefined();
  });

  it('returns undefined when a mapped target is an alias, not an entity', () => {
    const field = unionField({
      type: {
        kind: 'union',
        variants: [
          { kind: 'ref', ref: 'CardPayment' },
          { kind: 'ref', ref: 'Metadata' },
        ],
        discriminator: {
          propertyName: 'kind',
          mapping: { card: 'CardPayment', meta: 'Metadata' },
        },
      },
    });
    expect(discriminatedUnion(field, source)).toBeUndefined();
  });

  it('returns undefined for a list / nullable discriminated union', () => {
    const field = invoice.fields.find((f) => f.name === 'method');
    if (field === undefined) {
      throw new Error('no method field');
    }
    expect(
      discriminatedUnion({ ...field, nullable: true }, source),
    ).toBeUndefined();
  });
});

describe('unionType', () => {
  it('joins variant types with " | "', () => {
    const result = unionType(
      {
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'scalar', scalar: 'int' },
        ],
      },
      (r) => `${r}Dto`,
      (r) => r,
      new Set(),
    );
    expect(result).toEqual({ text: 'string | number', recursive: false });
  });

  it('widens a ref branch named in cyclicRefs to unknown', () => {
    const result = unionType(
      {
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'ref', ref: 'Tree' },
        ],
      },
      (r) => r,
      (r) => r,
      new Set(['Tree']),
    );
    expect(result).toEqual({ text: 'unknown', recursive: true });
  });
});
