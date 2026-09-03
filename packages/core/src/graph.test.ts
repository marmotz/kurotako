import { describe, expect, it } from 'vitest';
import {
  DependencyCycleError,
  InvalidDependencyError,
  UnknownDependencyError,
} from './errors.js';
import { generatorOrder } from './graph.js';
import type { Generator, GeneratorConfig } from './types.js';

function cfg(
  specs: Record<string, { dependsOn?: string[]; optionalDependsOn?: string[] }>,
): Record<string, GeneratorConfig> {
  const out: Record<string, GeneratorConfig> = {};
  for (const [name, spec] of Object.entries(specs)) {
    const generator: Generator = {
      name,
      dependsOn: spec.dependsOn,
      optionalDependsOn: spec.optionalDependsOn,
      generate: () => ({ files: [], artifact: { entities: {} } }),
    };
    out[name] = { generator };
  }
  return out;
}

describe('generatorOrder', () => {
  it('empty config -> []', () => {
    expect(generatorOrder({})).toEqual([]);
  });

  it('linear chain', () => {
    expect(
      generatorOrder(
        cfg({ c: { dependsOn: ['b'] }, b: { dependsOn: ['a'] }, a: {} }),
      ),
    ).toEqual(['a', 'b', 'c']);
  });

  it('diamond', () => {
    const order = generatorOrder(
      cfg({
        a: {},
        b: { dependsOn: ['a'] },
        c: { dependsOn: ['a'] },
        d: { dependsOn: ['b', 'c'] },
      }),
    );
    expect(order[0]).toBe('a');
    expect(order[3]).toBe('d');
    expect(order.slice(1, 3).sort()).toEqual(['b', 'c']);
  });

  it('optionalDependsOn present constrains order', () => {
    expect(
      generatorOrder(cfg({ angular: { optionalDependsOn: ['zod'] }, zod: {} })),
    ).toEqual(['zod', 'angular']);
  });

  it('optionalDependsOn absent is ignored', () => {
    expect(
      generatorOrder(cfg({ angular: { optionalDependsOn: ['zod'] } })),
    ).toEqual(['angular']);
  });

  it('missing hard dep -> UnknownDependencyError', () => {
    expect(() =>
      generatorOrder(cfg({ angular: { dependsOn: ['zod'] } })),
    ).toThrow(UnknownDependencyError);
  });

  it('a name in both arrays -> InvalidDependencyError', () => {
    expect(() =>
      generatorOrder(
        cfg({ a: {}, b: { dependsOn: ['a'], optionalDependsOn: ['a'] } }),
      ),
    ).toThrow(InvalidDependencyError);
  });

  it('tie-break follows config declaration order', () => {
    expect(generatorOrder(cfg({ b: {}, a: {}, c: {} }))).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('2-node cycle -> DependencyCycleError', () => {
    expect(() =>
      generatorOrder(cfg({ a: { dependsOn: ['b'] }, b: { dependsOn: ['a'] } })),
    ).toThrow(DependencyCycleError);
  });

  it('3-node cycle -> DependencyCycleError with a path', () => {
    try {
      generatorOrder(
        cfg({
          a: { dependsOn: ['c'] },
          b: { dependsOn: ['a'] },
          c: { dependsOn: ['b'] },
        }),
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(DependencyCycleError);
      const { cycle } = error as DependencyCycleError;
      expect(cycle.length).toBeGreaterThanOrEqual(4);
      expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    }
  });
});
