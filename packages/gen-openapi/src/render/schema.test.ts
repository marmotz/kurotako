import { describe, expect, it } from 'vitest';
import {
  renderFieldType,
  schemaRef,
  wrapListed,
  wrapNullable,
} from './schema.js';

describe('renderFieldType — scalar', () => {
  it.each([
    ['string', { type: 'string' }],
    ['boolean', { type: 'boolean' }],
    ['int', { type: 'integer' }],
    ['bigint', { type: 'integer', format: 'int64' }],
    ['float', { type: 'number' }],
    ['decimal', { type: 'number' }],
    ['date', { type: 'string', format: 'date' }],
    ['datetime', { type: 'string', format: 'date-time' }],
    ['uuid', { type: 'string', format: 'uuid' }],
    ['bytes', { type: 'string', format: 'byte' }],
    ['json', {}],
  ] as const)('maps scalar %s', (scalar, expected) => {
    expect(renderFieldType({ kind: 'scalar', scalar })).toEqual(expected);
  });
});

describe('renderFieldType — non-scalar kinds', () => {
  it('maps enum to a $ref', () => {
    expect(renderFieldType({ kind: 'enum', ref: 'Role' })).toEqual({
      $ref: '#/components/schemas/Role',
    });
  });

  it('maps unknown to an empty schema', () => {
    expect(renderFieldType({ kind: 'unknown' })).toEqual({});
    expect(renderFieldType({ kind: 'unknown', hint: 'object' })).toEqual({});
  });

  it('maps ref to a $ref', () => {
    expect(renderFieldType({ kind: 'ref', ref: 'Post' })).toEqual({
      $ref: '#/components/schemas/Post',
    });
  });

  it('maps map with an unknown value to additionalProperties: true', () => {
    expect(
      renderFieldType({ kind: 'map', value: { kind: 'unknown' } }),
    ).toEqual({ type: 'object', additionalProperties: true });
  });

  it('maps map with a typed value', () => {
    expect(
      renderFieldType({
        kind: 'map',
        value: { kind: 'scalar', scalar: 'int' },
      }),
    ).toEqual({
      type: 'object',
      additionalProperties: { type: 'integer' },
    });
  });

  it('maps array to items', () => {
    expect(
      renderFieldType({
        kind: 'array',
        element: { kind: 'scalar', scalar: 'string' },
      }),
    ).toEqual({ type: 'array', items: { type: 'string' } });
  });

  it('maps a plain union to oneOf', () => {
    expect(
      renderFieldType({
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'scalar', scalar: 'int' },
        ],
      }),
    ).toEqual({
      oneOf: [{ type: 'string' }, { type: 'integer' }],
    });
  });

  it('maps a discriminated union to oneOf + discriminator', () => {
    expect(
      renderFieldType({
        kind: 'union',
        variants: [
          { kind: 'ref', ref: 'Circle' },
          { kind: 'ref', ref: 'Square' },
        ],
        discriminator: {
          propertyName: 'kind',
          mapping: { circle: 'Circle', square: 'Square' },
        },
      }),
    ).toEqual({
      oneOf: [
        { $ref: '#/components/schemas/Circle' },
        { $ref: '#/components/schemas/Square' },
      ],
      discriminator: {
        propertyName: 'kind',
        mapping: {
          circle: '#/components/schemas/Circle',
          square: '#/components/schemas/Square',
        },
      },
    });
  });

  it('discriminator without a mapping', () => {
    expect(
      renderFieldType({
        kind: 'union',
        variants: [{ kind: 'ref', ref: 'Circle' }],
        discriminator: { propertyName: 'kind' },
      }),
    ).toEqual({
      oneOf: [{ $ref: '#/components/schemas/Circle' }],
      discriminator: { propertyName: 'kind' },
    });
  });
});

describe('schemaRef', () => {
  it('builds a components/schemas pointer', () => {
    expect(schemaRef('User')).toBe('#/components/schemas/User');
  });
});

describe('wrapListed', () => {
  it('wraps a scalar schema in an array', () => {
    expect(
      wrapListed({ type: 'string' }, { kind: 'scalar', scalar: 'string' }),
    ).toEqual({ type: 'array', items: { type: 'string' } });
  });

  it('does not double-wrap when the FieldType is already an array', () => {
    const schema = { type: 'array', items: { type: 'string' } };
    expect(
      wrapListed(schema, {
        kind: 'array',
        element: { kind: 'scalar', scalar: 'string' },
      }),
    ).toBe(schema);
  });
});

describe('wrapNullable', () => {
  it('3.1 widens a plain type to include null', () => {
    expect(wrapNullable({ type: 'string' }, '3.1')).toEqual({
      type: ['string', 'null'],
    });
  });

  it('3.1 wraps a $ref in oneOf', () => {
    expect(wrapNullable({ $ref: '#/components/schemas/User' }, '3.1')).toEqual({
      oneOf: [{ $ref: '#/components/schemas/User' }, { type: 'null' }],
    });
  });

  it('3.1 wraps a oneOf (union) further in oneOf', () => {
    const union = { oneOf: [{ type: 'string' }, { type: 'integer' }] };
    expect(wrapNullable(union, '3.1')).toEqual({
      oneOf: [union, { type: 'null' }],
    });
  });

  it('3.1 falls back to oneOf when there is no bare type to widen', () => {
    expect(wrapNullable({}, '3.1')).toEqual({
      oneOf: [{}, { type: 'null' }],
    });
  });

  it('3.0 adds nullable: true as a sibling', () => {
    expect(wrapNullable({ type: 'string' }, '3.0')).toEqual({
      type: 'string',
      nullable: true,
    });
  });

  it('3.0 wraps a $ref in allOf with nullable: true', () => {
    expect(wrapNullable({ $ref: '#/components/schemas/User' }, '3.0')).toEqual({
      allOf: [{ $ref: '#/components/schemas/User' }],
      nullable: true,
    });
  });
});
