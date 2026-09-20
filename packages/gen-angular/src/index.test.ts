import { zodGenerator } from '@kurotako/gen-zod';
import { describe, expect, it } from 'vitest';
import {
  AngularGenError,
  AngularGeneratorOptions,
  angularGenerator,
} from './index.js';

describe('@kurotako/gen-angular', () => {
  it('exposes the generator driver', () => {
    expect(angularGenerator.name).toBe('angular');
  });

  it('depends privately on a zod descriptor, forwarding zodVersion', () => {
    const dependsOn = angularGenerator.dependsOn;
    if (typeof dependsOn !== 'function') {
      throw new Error('angularGenerator.dependsOn must be the function form');
    }
    expect(dependsOn({ forms: [], relations: 'flat', zodVersion: 4 })).toEqual([
      { use: zodGenerator, options: { zodVersion: 4 } },
    ]);
    expect(dependsOn({ forms: [], relations: 'flat', zodVersion: 3 })).toEqual([
      { use: zodGenerator, options: { zodVersion: 3 } },
    ]);
  });

  it('exposes the options schema and error base class', () => {
    expect(AngularGeneratorOptions).toBeDefined();
    expect(new AngularGenError('x', 'y')).toBeInstanceOf(Error);
  });
});
