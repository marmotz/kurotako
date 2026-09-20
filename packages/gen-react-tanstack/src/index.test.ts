import { zodGenerator } from '@kurotako/gen-zod';
import { describe, expect, it } from 'vitest';
import {
  ReactTanstackGenError,
  ReactTanstackGeneratorOptions,
  reactTanstackGenerator,
} from './index.js';

describe('@kurotako/gen-react-tanstack', () => {
  it('exposes the generator driver', () => {
    expect(reactTanstackGenerator.name).toBe('react-tanstack');
  });

  it('depends privately on a zod descriptor, forwarding zodVersion', () => {
    const dependsOn = reactTanstackGenerator.dependsOn;
    if (typeof dependsOn !== 'function') {
      throw new Error(
        'reactTanstackGenerator.dependsOn must be the function form',
      );
    }
    const base = { variants: ['full' as const], relations: 'flat' as const };
    expect(dependsOn({ ...base, zodVersion: 4 })).toEqual([
      { use: zodGenerator, options: { zodVersion: 4 } },
    ]);
    expect(dependsOn({ ...base, zodVersion: 3 })).toEqual([
      { use: zodGenerator, options: { zodVersion: 3 } },
    ]);
  });

  it('exposes the options schema and error base class', () => {
    expect(ReactTanstackGeneratorOptions).toBeDefined();
    expect(new ReactTanstackGenError('x', 'y')).toBeInstanceOf(Error);
  });
});
