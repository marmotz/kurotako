import type { ScalarType } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { baseClass, baseExpr, unknownHintComment } from './scalars.js';

const scalar = (s: ScalarType) => ({ kind: 'scalar', scalar: s }) as const;

describe('baseExpr — every ScalarType, v4 vs v3', () => {
  const table: Array<[ScalarType, string, string]> = [
    ['string', 'z.string()', 'z.string()'],
    ['boolean', 'z.boolean()', 'z.boolean()'],
    ['int', 'z.int()', 'z.number().int()'],
    ['bigint', 'z.bigint()', 'z.bigint()'],
    ['float', 'z.number()', 'z.number()'],
    ['decimal', 'z.string()', 'z.string()'],
    ['date', 'z.coerce.date()', 'z.coerce.date()'],
    ['datetime', 'z.coerce.date()', 'z.coerce.date()'],
    ['uuid', 'z.uuid()', 'z.string().uuid()'],
    ['bytes', 'z.string()', 'z.string()'],
    ['json', 'z.unknown()', 'z.unknown()'],
  ];
  for (const [s, v4, v3] of table) {
    it(s, () => {
      expect(baseExpr(scalar(s), dialectFor(4))).toBe(v4);
      expect(baseExpr(scalar(s), dialectFor(3))).toBe(v3);
    });
  }
});

describe('baseExpr — enum and unknown', () => {
  it('enum -> <Enum>Schema', () => {
    expect(baseExpr({ kind: 'enum', ref: 'Role' }, dialectFor(4))).toBe(
      'RoleSchema',
    );
  });
  it('unknown -> z.unknown() with hint comment', () => {
    expect(baseExpr({ kind: 'unknown' }, dialectFor(4))).toBe('z.unknown()');
    expect(unknownHintComment({ kind: 'unknown' })).toBe('// unknown');
    expect(unknownHintComment({ kind: 'unknown', hint: 'point' })).toBe(
      '// unknown: point',
    );
    expect(unknownHintComment(scalar('string'))).toBeNull();
  });
});

describe('baseClass', () => {
  it('string family', () => {
    for (const s of ['string', 'uuid', 'decimal', 'bytes'] as ScalarType[]) {
      expect(baseClass(scalar(s))).toBe('string');
    }
  });
  it('number family', () => {
    for (const s of ['int', 'float', 'bigint'] as ScalarType[]) {
      expect(baseClass(scalar(s))).toBe('number');
    }
  });
  it('other', () => {
    expect(baseClass(scalar('date'))).toBe('other');
    expect(baseClass({ kind: 'enum', ref: 'Role' })).toBe('other');
  });
});
