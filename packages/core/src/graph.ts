/**
 * `generatorOrder` — deterministic topological sort of the generator dependency
 * graph (ADR-0002). `dependsOn` is a hard dependency (absent from the config =>
 * error); `optionalDependsOn` is soft (absent => the edge is dropped). Both
 * constrain order. Kahn's algorithm, ties broken by config declaration order.
 */
import {
  DependencyCycleError,
  InvalidDependencyError,
  UnknownDependencyError,
} from './errors.js';
import type { GeneratorConfig } from './types.js';

export function generatorOrder(
  generators: Record<string, GeneratorConfig>,
): string[] {
  const names = Object.keys(generators);
  const index = new Map(names.map((name, i) => [name, i]));

  // adjacency: dep -> dependents; indegree counts incoming hard+optional edges.
  const dependents = new Map<string, string[]>(names.map((n) => [n, []]));
  const indegree = new Map<string, number>(names.map((n) => [n, 0]));

  for (const name of names) {
    const cfg = generators[name];
    const hard = cfg?.generator.dependsOn ?? [];
    const optional = cfg?.generator.optionalDependsOn ?? [];

    const seen = new Set<string>();
    const addEdge = (dep: string) => {
      if (seen.has(dep)) {
        return;
      }
      seen.add(dep);
      dependents.get(dep)?.push(name);
      indegree.set(name, (indegree.get(name) ?? 0) + 1);
    };

    for (const dep of hard) {
      if (optional.includes(dep)) {
        throw new InvalidDependencyError(name, dep);
      }
      if (!index.has(dep)) {
        throw new UnknownDependencyError(name, dep);
      }
      addEdge(dep);
    }
    for (const dep of optional) {
      if (!index.has(dep)) {
        continue;
      }
      addEdge(dep);
    }
  }

  const byConfigOrder = (a: string, b: string) =>
    (index.get(a) ?? 0) - (index.get(b) ?? 0);

  const ready = names
    .filter((n) => (indegree.get(n) ?? 0) === 0)
    .sort(byConfigOrder);
  const order: string[] = [];

  while (ready.length > 0) {
    const node = ready.shift() as string;
    order.push(node);
    for (const dependent of dependents.get(node) ?? []) {
      const next = (indegree.get(dependent) ?? 0) - 1;
      indegree.set(dependent, next);
      if (next === 0) {
        ready.push(dependent);
        ready.sort(byConfigOrder);
      }
    }
  }

  if (order.length < names.length) {
    const remaining = new Set(names.filter((n) => !order.includes(n)));
    throw new DependencyCycleError(findCycle(remaining, dependents));
  }

  return order;
}

/**
 * Extract a readable cycle path from the residual subgraph. `dependents` maps
 * `dep -> [dependents]`; we walk that direction and report the loop we close.
 */
function findCycle(
  nodes: Set<string>,
  dependents: Map<string, string[]>,
): string[] {
  const stack: string[] = [];
  const onStack = new Set<string>();
  const visited = new Set<string>();

  const walk = (node: string): string[] | undefined => {
    stack.push(node);
    onStack.add(node);
    for (const next of dependents.get(node) ?? []) {
      if (!nodes.has(next)) {
        continue;
      }
      if (onStack.has(next)) {
        return [...stack.slice(stack.indexOf(next)), next];
      }
      if (!visited.has(next)) {
        const found = walk(next);
        if (found) {
          return found;
        }
      }
    }
    stack.pop();
    onStack.delete(node);
    visited.add(node);
    return undefined;
  };

  for (const node of nodes) {
    if (!visited.has(node)) {
      const found = walk(node);
      if (found) {
        return found;
      }
    }
  }
  return [...nodes];
}
