import { describe, expect, it } from 'vitest';
import { dialectFor } from './dialect.js';

describe('dialectFor', () => {
  it('v4 leaf builders', () => {
    const d = dialectFor(4);
    expect(d.version).toBe(4);
    expect(d.scalarInt()).toBe('z.int()');
    expect(d.scalarUuid()).toBe('z.uuid()');
    expect(d.stringFormat('email', 'z.string()')).toBe('z.email()');
    expect(d.stringFormat('datetime', 'z.string()')).toBe('z.iso.datetime()');
    expect(d.stringFormat('ipv4', 'z.string()')).toBe('z.ipv4()');
  });

  it('v3 leaf builders', () => {
    const d = dialectFor(3);
    expect(d.version).toBe(3);
    expect(d.scalarInt()).toBe('z.number().int()');
    expect(d.scalarUuid()).toBe('z.string().uuid()');
    expect(d.stringFormat('email', 'z.string()')).toBe('z.string().email()');
    expect(d.stringFormat('datetime', 'z.string()')).toBe(
      'z.string().datetime()',
    );
    expect(d.stringFormat('ipv4', 'z.string()')).toBe(
      "z.string().ip({ version: 'v4' })",
    );
  });
});
