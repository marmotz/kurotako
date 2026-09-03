/**
 * `filterIR` — the namespace-filtered IR view handed to a generator. A deep
 * clone (`structuredClone`) so a misbehaving generator cannot mutate shared
 * state. Relations targeting an excluded namespace stay in the clone as-is:
 * `@kurotako/ir` treats an absent target namespace as informational and v1
 * drivers ignore cross-source relations.
 */
import type { IR, SourceIR } from '@kurotako/ir';

/**
 * `undefined` namespaces => a clone of the whole IR. Otherwise => a clone
 * keeping only the requested keys in `ir.sources`, in the original key order. A
 * requested namespace absent from `ir.sources` is ignored (`filterIR` stays
 * total; config validity is config-system's job).
 */
export function filterIR(ir: IR, namespaces?: string[]): IR {
  const clone = structuredClone(ir);
  if (namespaces === undefined) {
    return clone;
  }

  const keep = new Set(namespaces);
  const sources: Record<string, SourceIR> = {};
  for (const [key, source] of Object.entries(clone.sources)) {
    if (keep.has(key)) {
      sources[key] = source;
    }
  }
  clone.sources = sources;
  return clone;
}
