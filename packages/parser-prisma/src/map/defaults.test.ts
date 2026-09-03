import { describe, expect, it } from 'vitest';
import { mapDefault } from './defaults.js';

describe('mapDefault', () => {
  it('returns nothing for an absent default', () => {
    expect(mapDefault(undefined)).toEqual({});
  });

  it('maps literals to a value default', () => {
    expect(mapDefault('x')).toEqual({ default: { kind: 'value', value: 'x' } });
    expect(mapDefault(42)).toEqual({ default: { kind: 'value', value: 42 } });
    expect(mapDefault(true)).toEqual({
      default: { kind: 'value', value: true },
    });
    expect(mapDefault(['a', 'b'])).toEqual({
      default: { kind: 'value', value: ['a', 'b'] },
    });
  });

  it('maps an enum value (bare string) to a value default', () => {
    expect(mapDefault('ADMIN')).toEqual({
      default: { kind: 'value', value: 'ADMIN' },
    });
  });

  it('maps now() / autoincrement() to an expr default', () => {
    expect(mapDefault({ name: 'now', args: [] })).toEqual({
      default: { kind: 'expr', expr: 'now()' },
    });
    expect(mapDefault({ name: 'autoincrement', args: [] })).toEqual({
      default: { kind: 'expr', expr: 'autoincrement()' },
    });
  });

  it('maps dbgenerated("…") keeping the args', () => {
    expect(
      mapDefault({ name: 'dbgenerated', args: ['gen_random_uuid()'] }),
    ).toEqual({
      default: {
        kind: 'expr',
        expr: 'dbgenerated',
        args: ['gen_random_uuid()'],
      },
    });
  });

  it('maps uuid()/cuid()/ulid() to an expr default plus a format', () => {
    expect(mapDefault({ name: 'uuid', args: [4] })).toEqual({
      default: { kind: 'expr', expr: 'uuid()' },
      format: 'uuid',
    });
    expect(mapDefault({ name: 'cuid', args: [1] })).toEqual({
      default: { kind: 'expr', expr: 'cuid()' },
      format: 'cuid',
    });
    expect(mapDefault({ name: 'cuid', args: [2] })).toEqual({
      default: { kind: 'expr', expr: 'cuid()' },
      format: 'cuid2',
    });
    expect(mapDefault({ name: 'ulid', args: [] })).toEqual({
      default: { kind: 'expr', expr: 'ulid()' },
      format: 'ulid',
    });
  });

  it('maps nanoid() to an expr default with no format', () => {
    expect(mapDefault({ name: 'nanoid', args: [] })).toEqual({
      default: { kind: 'expr', expr: 'nanoid()' },
    });
  });
});
