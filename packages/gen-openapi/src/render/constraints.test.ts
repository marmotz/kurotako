import { describe, expect, it } from 'vitest';
import { applyConstraints } from './constraints.js';

const stringType = { kind: 'scalar', scalar: 'string' } as const;
const intType = { kind: 'scalar', scalar: 'int' } as const;

describe('applyConstraints', () => {
  it('maps min/max to minimum/maximum', () => {
    expect(applyConstraints({}, intType, { min: 0, max: 150 })).toEqual({
      minimum: 0,
      maximum: 150,
    });
  });

  it('maps minLength/maxLength', () => {
    expect(
      applyConstraints({}, stringType, { minLength: 1, maxLength: 255 }),
    ).toEqual({ minLength: 1, maxLength: 255 });
  });

  it('maps regex to pattern', () => {
    expect(applyConstraints({}, stringType, { regex: '^[a-z]+$' })).toEqual({
      pattern: '^[a-z]+$',
    });
  });

  it.each([
    ['email', 'email'],
    ['url', 'uri'],
    ['ipv4', 'ipv4'],
    ['ipv6', 'ipv6'],
    ['time', 'time'],
    ['duration', 'duration'],
  ] as const)('maps string format %s to %s', (format, keyword) => {
    expect(applyConstraints({}, stringType, { format })).toEqual({
      format: keyword,
    });
  });

  it('drops a format with no OpenAPI equivalent', () => {
    expect(applyConstraints({}, stringType, { format: 'cuid' })).toEqual({});
  });

  it('does not apply format to a non-string scalar', () => {
    expect(applyConstraints({}, intType, { format: 'email' })).toEqual({});
  });

  it('drops unique silently', () => {
    expect(applyConstraints({}, stringType, { unique: true })).toEqual({});
  });

  it('merges onto an existing schema without mutating it', () => {
    const base = { type: 'string' };
    const out = applyConstraints(base, stringType, { maxLength: 10 });
    expect(out).toEqual({ type: 'string', maxLength: 10 });
    expect(base).toEqual({ type: 'string' });
  });
});
