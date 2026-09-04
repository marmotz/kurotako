import { describe, expect, it } from 'vitest';
import {
  AngularGenError,
  AngularGeneratorOptions,
  angularGenerator,
} from './index.js';

describe('@kurotako/gen-angular', () => {
  it('exposes the generator driver', () => {
    expect(angularGenerator.name).toBe('angular');
    expect(angularGenerator.dependsOn).toEqual(['zod']);
  });

  it('exposes the options schema and error base class', () => {
    expect(AngularGeneratorOptions).toBeDefined();
    expect(new AngularGenError('x', 'y')).toBeInstanceOf(Error);
  });
});
