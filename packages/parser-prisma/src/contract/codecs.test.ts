import type { Logger } from '@kurotako/core';
import { describe, expect, it, vi } from 'vitest';
import { PrismaDialectError } from '../errors.js';
import { mapCodec } from './codecs.js';

describe('mapCodec', () => {
  it.each([
    ['pg/text@1', 'string'],
    ['pg/bool@1', 'boolean'],
    ['pg/int4@1', 'int'],
    ['pg/int8@1', 'bigint'],
    ['pg/numeric@1', 'decimal'],
    ['pg/timestamptz-temporal@1', 'datetime'],
    ['pg/jsonb@1', 'json'],
    ['pg/bytea@1', 'bytes'],
  ] as const)('maps %s', (codec, scalar) => {
    expect(mapCodec(codec).type).toEqual({ kind: 'scalar', scalar });
  });

  it('ignores a compatible codec version while logging it', () => {
    const debug = vi.fn();
    const logger: Logger = { debug, info() {}, warn() {}, error() {} };
    expect(mapCodec('pg/text@2', logger).type).toEqual({
      kind: 'scalar',
      scalar: 'string',
    });
    expect(debug).toHaveBeenCalledWith(
      "prisma parser: contract codec 'pg/text' version 2",
    );
  });

  it('keeps unknown PostgreSQL codecs as unknown fields', () => {
    expect(mapCodec('pg/future@1').type).toEqual({
      kind: 'unknown',
      hint: 'pg/future@1',
    });
  });

  it('allows the SQL-family varchar codec and preserves its length marker', () => {
    expect(mapCodec('sql/varchar@1')).toMatchObject({ needsLength: true });
  });

  it('rejects another database dialect', () => {
    expect(() => mapCodec('mysql/int4@1')).toThrow(PrismaDialectError);
  });
});
