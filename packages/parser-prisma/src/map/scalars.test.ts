import { describe, expect, it } from 'vitest';
import type { PrismaField } from '../dmmf/model.js';
import { mapFieldType } from './scalars.js';

function field(partial: Partial<PrismaField> & { type: string }): PrismaField {
  return {
    name: 'f',
    kind: 'scalar',
    isList: false,
    isRequired: true,
    isUnique: false,
    isUpdatedAt: false,
    hasDefaultValue: false,
    nativeType: null,
    ...partial,
  };
}

describe('mapFieldType — base scalars', () => {
  const cases: Array<[string, string]> = [
    ['String', 'string'],
    ['Boolean', 'boolean'],
    ['Int', 'int'],
    ['BigInt', 'bigint'],
    ['Float', 'float'],
    ['Decimal', 'decimal'],
    ['DateTime', 'datetime'],
    ['Json', 'json'],
    ['Bytes', 'bytes'],
  ];
  for (const [prisma, scalar] of cases) {
    it(`${prisma} → ${scalar}`, () => {
      expect(mapFieldType(field({ type: prisma }))).toEqual({
        type: { kind: 'scalar', scalar },
        constraints: {},
      });
    });
  }

  it('Unsupported field → unknown with hint', () => {
    expect(
      mapFieldType(
        field({ type: 'Unsupported("point")', kind: 'unsupported' }),
      ),
    ).toEqual({
      type: { kind: 'unknown', hint: 'Unsupported("point")' },
      constraints: {},
    });
  });

  it('enum field → enum ref', () => {
    expect(mapFieldType(field({ type: 'Role', kind: 'enum' })).type).toEqual({
      kind: 'enum',
      ref: 'Role',
    });
  });
});

describe('mapFieldType — native @db.* refinement', () => {
  it('@db.VarChar(120) → maxLength 120', () => {
    const mapped = mapFieldType(
      field({ type: 'String', nativeType: ['VarChar', ['120']] }),
    );
    expect(mapped.constraints.maxLength).toBe(120);
    expect(mapped.type).toEqual({ kind: 'scalar', scalar: 'string' });
  });

  it('@db.Uuid → scalar override uuid', () => {
    const mapped = mapFieldType(
      field({ type: 'String', nativeType: ['Uuid', []] }),
    );
    expect(mapped.scalarOverride).toBe('uuid');
  });

  it('@db.Date on DateTime → scalar override date', () => {
    const mapped = mapFieldType(
      field({ type: 'DateTime', nativeType: ['Date', []] }),
    );
    expect(mapped.scalarOverride).toBe('date');
  });

  it('@db.Time → format time, scalar stays datetime', () => {
    const mapped = mapFieldType(
      field({ type: 'DateTime', nativeType: ['Time', ['6']] }),
    );
    expect(mapped.constraints.format).toBe('time');
    expect(mapped.scalarOverride).toBeUndefined();
  });

  it('unknown native type is ignored', () => {
    const mapped = mapFieldType(
      field({ type: 'String', nativeType: ['MadeUpType', []] }),
    );
    expect(mapped.constraints).toEqual({});
    expect(mapped.scalarOverride).toBeUndefined();
  });
});
