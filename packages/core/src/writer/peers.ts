/**
 * Peer-dependency aggregation for mode B. Each generated package (one per
 * namespace) declares the union of the `peerDependencies` of every generator
 * that contributed to it. The consuming app provides the runtime (`zod`,
 * `@angular/*`); the generated package must not drag a second copy.
 *
 * Design: `backlog/features/output-modes/technical.md` §`packageWriter` (mode B).
 */
import { OutputPeerConflictError } from '../errors.js';
import type { GeneratorArtifact, VirtualFile } from '../types.js';
import { contributingGenerators } from './tree.js';

/**
 * Namespace -> (package -> semver range). Per namespace, union the
 * `peerDependencies` of every generator that emitted a file under
 * `<namespace>/<generatorName>/`. Identical ranges de-duplicate; the same
 * package with two different ranges from two generators throws
 * `OutputPeerConflictError` (fail-fast). Namespace and package keys are sorted.
 */
export function collectPeerDependencies(
  artifactsByGenerator: Record<string, GeneratorArtifact>,
  files: VirtualFile[],
): Record<string, Record<string, string>> {
  const contributors = contributingGenerators(files);
  const result: Record<string, Record<string, string>> = {};

  for (const namespace of [...contributors.keys()].sort()) {
    const generators = contributors.get(namespace) ?? [];
    const merged = new Map<string, { range: string; generator: string }>();

    for (const generator of generators) {
      const peers = artifactsByGenerator[generator]?.peerDependencies;
      if (!peers) {
        continue;
      }
      for (const [pkg, range] of Object.entries(peers)) {
        const existing = merged.get(pkg);
        if (existing && existing.range !== range) {
          throw new OutputPeerConflictError(
            namespace,
            pkg,
            [existing.range, range],
            [existing.generator, generator],
          );
        }
        if (!existing) {
          merged.set(pkg, { range, generator });
        }
      }
    }

    const sorted: Record<string, string> = {};
    for (const pkg of [...merged.keys()].sort()) {
      const entry = merged.get(pkg);
      if (entry) {
        sorted[pkg] = entry.range;
      }
    }
    result[namespace] = sorted;
  }

  return result;
}
