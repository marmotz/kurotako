import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { ReactTanstackGeneratorOptions } from './options.js';

describe('ReactTanstackGeneratorOptions', () => {
  it('defaults: Zod 4, all entities, the full variant, flat relations', () => {
    expect(v.parse(ReactTanstackGeneratorOptions, {})).toEqual({
      zodVersion: 4,
      variants: ['full'],
      relations: 'flat',
    });
  });

  it('accepts zodVersion 3 and rejects other versions', () => {
    expect(
      v.parse(ReactTanstackGeneratorOptions, { zodVersion: 3 }).zodVersion,
    ).toBe(3);
    expect(() =>
      v.parse(ReactTanstackGeneratorOptions, { zodVersion: 5 }),
    ).toThrow();
  });

  it('accepts an include list', () => {
    expect(
      v.parse(ReactTanstackGeneratorOptions, { include: ['LoginDto'] }).include,
    ).toEqual(['LoginDto']);
  });

  it('accepts any non-empty variants subset', () => {
    expect(
      v.parse(ReactTanstackGeneratorOptions, {
        variants: ['create', 'update'],
      }).variants,
    ).toEqual(['create', 'update']);
  });

  it('rejects an empty variants list and an unknown variant', () => {
    expect(() =>
      v.parse(ReactTanstackGeneratorOptions, { variants: [] }),
    ).toThrow();
    expect(() =>
      v.parse(ReactTanstackGeneratorOptions, { variants: ['bogus'] }),
    ).toThrow();
  });

  it('accepts relations: deep and rejects an unknown mode', () => {
    expect(
      v.parse(ReactTanstackGeneratorOptions, { relations: 'deep' }).relations,
    ).toBe('deep');
    expect(() =>
      v.parse(ReactTanstackGeneratorOptions, { relations: 'nested' }),
    ).toThrow();
  });
});
