import type { Field, ScalarType } from '@kurotako/ir';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import {
  controlExpr,
  controlsInterface,
  controlType,
  enumZeroFromSource,
  fieldControlEntry,
  initExpr,
  type TypeResolvers,
} from './controls.js';

function scalarField(
  scalar: ScalarType,
  overrides: Partial<Field> = {},
): Field {
  return {
    name: 'x',
    type: { kind: 'scalar', scalar },
    list: false,
    optional: false,
    nullable: false,
    constraints: {},
    ...overrides,
  };
}

/** A `TypeResolvers` whose enum/ref resolution is caller-supplied. */
function resolvers(overrides: Partial<TypeResolvers> = {}): TypeResolvers {
  return {
    enumTypeName: () => {
      throw new Error('no enum expected');
    },
    refTypeName: () => {
      throw new Error('no ref expected');
    },
    cyclicRefs: new Set(),
    ...overrides,
  };
}

const noEnum = resolvers();

describe('controlType', () => {
  const cases: [ScalarType, string][] = [
    ['string', 'string'],
    ['uuid', 'string'],
    ['decimal', 'string'],
    ['bytes', 'string'],
    ['int', 'number'],
    ['float', 'number'],
    ['bigint', 'bigint'],
    ['boolean', 'boolean'],
    ['date', 'Date'],
    ['datetime', 'Date'],
    ['json', 'unknown'],
  ];

  it.each(cases)('%s -> %s', (scalar, expected) => {
    expect(controlType(scalarField(scalar), noEnum)).toBe(expected);
  });

  it('enum field -> the Zod-emitted union type name', () => {
    const field = scalarField('string', {
      type: { kind: 'enum', ref: 'Role' },
    });
    expect(
      controlType(field, resolvers({ enumTypeName: (ref) => `${ref}Enum` })),
    ).toBe('RoleEnum');
  });

  it('unknown field -> unknown', () => {
    const field = scalarField('string', { type: { kind: 'unknown' } });
    expect(controlType(field, noEnum)).toBe('unknown');
  });

  it('map field -> Record control type and empty-object seed', () => {
    const field = scalarField('string', {
      type: { kind: 'map', value: { kind: 'scalar', scalar: 'int' } },
    });
    expect(controlType(field, noEnum)).toBe('Record<string, number>');
    expect(initExpr(field)).toBe('{}');
  });

  it('array field -> T[] control type and empty-array seed', () => {
    const field = scalarField('string', {
      type: { kind: 'array', element: { kind: 'ref', ref: 'Task' } },
    });
    expect(
      controlType(field, resolvers({ refTypeName: (r) => `${r}Dto` })),
    ).toBe('TaskDto[]');
    expect(initExpr(field)).toBe('[]');
  });

  it('ref field -> the resolved Zod DTO / alias type name', () => {
    const field = scalarField('string', {
      type: { kind: 'ref', ref: 'Address' },
    });
    expect(
      controlType(field, resolvers({ refTypeName: (r) => `${r}Dto` })),
    ).toBe('AddressDto');
  });

  it('non-discriminated union field -> the variant types joined with " | "', () => {
    const field = scalarField('string', {
      type: {
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'scalar', scalar: 'int' },
          { kind: 'ref', ref: 'Address' },
        ],
      },
    });
    expect(
      controlType(field, resolvers({ refTypeName: (r) => `${r}Dto` })),
    ).toBe('string | number | AddressDto');
  });

  it('list wraps before nullable', () => {
    const field = scalarField('string', { list: true, nullable: true });
    expect(controlType(field, noEnum)).toBe('string[] | null');
  });

  it('nullable without list', () => {
    const field = scalarField('int', { nullable: true });
    expect(controlType(field, noEnum)).toBe('number | null');
  });
});

describe('initExpr', () => {
  it('a literal default seeds the control', () => {
    const field = scalarField('boolean', {
      default: { kind: 'value', value: false },
    });
    expect(initExpr(field)).toBe('false');
  });

  it('an expr default falls through to the type zero (never null for a non-nullable field)', () => {
    const field = scalarField('datetime', {
      default: { kind: 'expr', expr: 'now()' },
    });
    expect(initExpr(field)).toBe('new Date(0)');
  });

  it('a nullable field with no default zeroes to null', () => {
    const field = scalarField('datetime', { nullable: true });
    expect(initExpr(field)).toBe('null');
  });

  it.each<[ScalarType, string]>([
    ['string', "''"],
    ['int', '0'],
    ['bigint', '0n'],
    ['boolean', 'false'],
    ['date', 'new Date(0)'],
    ['datetime', 'new Date(0)'],
    ['json', 'undefined'],
  ])('zero value for %s', (scalar, expected) => {
    expect(initExpr(scalarField(scalar))).toBe(expected);
  });

  it('a list field zeroes to an empty array', () => {
    expect(initExpr(scalarField('string', { list: true }))).toBe('[]');
  });

  it('an enum field with no default zeroes to the resolved first member literal, not undefined', () => {
    const field = scalarField('string', {
      type: { kind: 'enum', ref: 'Role' },
    });
    expect(initExpr(field, () => 'ADMIN')).toBe('"ADMIN"');
  });

  it('an enum field with no default and no resolver falls back to undefined', () => {
    const field = scalarField('string', {
      type: { kind: 'enum', ref: 'Role' },
    });
    expect(initExpr(field)).toBe('undefined');
  });

  it('a ref field zeroes to undefined (no synthesisable zero)', () => {
    expect(
      initExpr(scalarField('string', { type: { kind: 'ref', ref: 'A' } })),
    ).toBe('undefined');
  });

  it('a union field zeroes to undefined', () => {
    const field = scalarField('string', {
      type: {
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'scalar', scalar: 'int' },
        ],
      },
    });
    expect(initExpr(field)).toBe('undefined');
  });
});

describe('controlExpr', () => {
  it('non-nullable field: nonNullable: true, no explicit type argument', () => {
    const field = scalarField('string');
    expect(controlExpr(field, 'string', "''")).toBe(
      "new FormControl('', { nonNullable: true })",
    );
  });

  it('nullable field: explicit <T | null> type argument, sourceExpr used as-is (already null-inclusive)', () => {
    const field = scalarField('string', { nullable: true });
    expect(controlExpr(field, 'string | null', 'value.x')).toBe(
      'new FormControl<string | null>(value.x)',
    );
  });

  it('ref / union fallback field: explicit type argument, seed cast, validated-by-zod comment', () => {
    const field = scalarField('string', {
      type: {
        kind: 'union',
        variants: [
          { kind: 'scalar', scalar: 'string' },
          { kind: 'scalar', scalar: 'int' },
        ],
      },
    });
    expect(controlExpr(field, 'string | number', 'init?.x ?? undefined')).toBe(
      'new FormControl<string | number>((init?.x ?? undefined) as string | number) /* union: validated by zodValidator(schema) */',
    );
  });
});

describe('enumZeroFromSource', () => {
  it('resolves the enum ref to its first declared member', () => {
    const source = createSourceIR({ namespace: 'pg', parser: 'test' })
      .addEnum('Provider', (e) =>
        e.value('OpenAi').value('Anthropic').value('Google'),
      )
      .addEntity('AiModel', (t) => {
        t.field('provider', (f) => f.enum('Provider'));
      })
      .build();
    const entity = source.entities.AiModel;
    if (entity === undefined) {
      throw new Error('fixture has no entity AiModel');
    }
    expect(enumZeroFromSource(source, entity)('Provider')).toBe('OpenAi');
  });

  it('returns undefined for an unresolvable ref', () => {
    const source = createSourceIR({ namespace: 'pg', parser: 'test' }).build();
    const entity = {
      name: 'X',
      fields: [],
      relations: [],
      indexes: [],
      uniques: [],
    };
    expect(enumZeroFromSource(source, entity)('Bogus')).toBeUndefined();
  });
});

describe('controlsInterface', () => {
  it('emits one member per entry', () => {
    const entry = fieldControlEntry(scalarField('string'), noEnum);
    const text = controlsInterface('UserCreateFormControls', [entry]);
    expect(text).toBe(
      'export interface UserCreateFormControls {\n  x: FormControl<string>;\n}',
    );
  });

  it('emits an empty interface for no entries', () => {
    expect(controlsInterface('UserUpdateFormControls', [])).toBe(
      'export interface UserUpdateFormControls {}',
    );
  });
});
