import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { AngularGeneratorOptions } from './options.js';

describe('AngularGeneratorOptions', () => {
  it('defaults: both form surfaces, flat relations, Zod 4', () => {
    const result = v.parse(AngularGeneratorOptions, {});
    expect(result).toEqual({
      forms: ['reactive', 'signal'],
      relations: 'flat',
      zodVersion: 4,
    });
  });

  it('accepts zodVersion 3 and rejects other versions', () => {
    expect(v.parse(AngularGeneratorOptions, { zodVersion: 3 }).zodVersion).toBe(
      3,
    );
    expect(() => v.parse(AngularGeneratorOptions, { zodVersion: 5 })).toThrow();
  });

  it('accepts an explicit forms subset', () => {
    const result = v.parse(AngularGeneratorOptions, { forms: ['signal'] });
    expect(result.forms).toEqual(['signal']);
  });

  it('accepts an empty forms array (valid, if pointless)', () => {
    const result = v.parse(AngularGeneratorOptions, { forms: [] });
    expect(result.forms).toEqual([]);
  });

  it('accepts relations: deep', () => {
    const result = v.parse(AngularGeneratorOptions, { relations: 'deep' });
    expect(result.relations).toBe('deep');
  });

  it('rejects an unknown forms value', () => {
    expect(() =>
      v.parse(AngularGeneratorOptions, { forms: ['bogus'] }),
    ).toThrow();
  });

  it('rejects an unknown relations value', () => {
    expect(() =>
      v.parse(AngularGeneratorOptions, { relations: 'bogus' }),
    ).toThrow();
  });
});
