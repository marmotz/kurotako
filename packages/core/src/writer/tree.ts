/**
 * Shared virtual-tree helpers for the writer layer. A generator owns the
 * `<namespace>/<generatorName>/` sub-tree; barrel synthesis and mode-B
 * packaging both need the namespace -> contributing-generators mapping.
 */
import type { VirtualFile } from '../types.js';

/**
 * Map each namespace (first path segment) to the sorted list of generator
 * names (second path segment) that emitted at least one file under
 * `<namespace>/<generatorName>/`. Files with fewer than three segments (e.g. a
 * stray `<namespace>/index.ts`) contribute no generator name.
 */
export function contributingGenerators(
  files: VirtualFile[],
): Map<string, string[]> {
  const acc = new Map<string, Set<string>>();
  for (const file of files) {
    const parts = file.path.split('/');
    if (parts.length < 3) {
      continue;
    }
    const [namespace, generator] = parts;
    if (!namespace || !generator) {
      continue;
    }
    let set = acc.get(namespace);
    if (!set) {
      set = new Set<string>();
      acc.set(namespace, set);
    }
    set.add(generator);
  }

  const out = new Map<string, string[]>();
  for (const [namespace, set] of acc) {
    out.set(namespace, [...set].sort());
  }
  return out;
}
