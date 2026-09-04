/**
 * `mergeTrees` — aggregate every generator's virtual file tree into one sorted
 * list, rejecting paths that escape the output root and paths claimed by two
 * generators. The synthesized `<ns>/index.ts` barrel and the banner pass are
 * separate `run.ts` steps (added by output-modes); `mergeTrees` only aggregates
 * and detects collisions.
 */
import path from 'node:path';
import { InvalidOutputPathError, OutputCollisionError } from './errors.js';
import type { VirtualFile } from './types.js';

export interface GeneratorTree {
  generator: string;
  files: VirtualFile[];
}

/**
 * Normalize to a POSIX path relative to the root. Throws `InvalidOutputPathError`
 * for an absolute path or one that climbs above the root.
 */
function normalizePath(rawPath: string, generator: string): string {
  const posix = rawPath.replace(/\\/g, '/');
  if (posix.startsWith('/')) {
    throw new InvalidOutputPathError(rawPath, generator);
  }
  const normalized = path.posix.normalize(posix);
  if (
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.posix.isAbsolute(normalized)
  ) {
    throw new InvalidOutputPathError(rawPath, generator);
  }
  return normalized;
}

export function mergeTrees(
  perGenerator: GeneratorTree[],
  opts?: { collisionHint?: string },
): VirtualFile[] {
  const byPath = new Map<string, { generator: string; file: VirtualFile }>();

  for (const { generator, files } of perGenerator) {
    for (const file of files) {
      const normalized = normalizePath(file.path, generator);
      const existing = byPath.get(normalized);
      if (existing) {
        throw new OutputCollisionError(
          normalized,
          [existing.generator, generator],
          opts?.collisionHint,
        );
      }
      byPath.set(normalized, {
        generator,
        file: { path: normalized, content: file.content },
      });
    }
  }

  return [...byPath.values()]
    .map((entry) => entry.file)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}
