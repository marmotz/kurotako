/**
 * Root-barrel synthesis. Each generator owns `<namespace>/<generatorName>/` and
 * emits its own barrel there; `tako` synthesizes `<namespace>/index.ts` so
 * `import … from '<scope>/<namespace>'` resolves regardless of how many
 * generators ran. Mode-independent — mode A and mode B both get the barrel.
 *
 * Design: `backlog/features/output-modes/technical.md` §New orchestration step.
 */
import type { GeneratorArtifact, Logger, VirtualFile } from '../types.js';
import { contributingGenerators } from './tree.js';

/**
 * One `VirtualFile { path: '<ns>/index.ts' }` per namespace present in `files`,
 * its content one sorted `export * from './<generatorName>';` line per
 * generator that contributed a file under `<ns>/<generatorName>/`. A
 * single-generator namespace still gets a barrel.
 *
 * When `artifactsByGenerator` is supplied, `logger?.warn(...)` fires if the same
 * exported identifier appears in two contributing artifacts for one namespace
 * (an ambiguous star re-export TypeScript/ESM silently drops). Never throws.
 */
export function synthesizeRootBarrels(
  files: VirtualFile[],
  artifactsByGenerator?: Record<string, GeneratorArtifact>,
  logger?: Logger,
): VirtualFile[] {
  const contributors = contributingGenerators(files);
  const barrels: VirtualFile[] = [];

  for (const namespace of [...contributors.keys()].sort()) {
    const generators = contributors.get(namespace) ?? [];
    if (artifactsByGenerator && logger) {
      warnAmbiguousReExports(
        namespace,
        generators,
        artifactsByGenerator,
        logger,
      );
    }
    const content = generators
      .map((name) => `export * from './${name}';\n`)
      .join('');
    barrels.push({ path: `${namespace}/index.ts`, content });
  }

  return barrels;
}

function warnAmbiguousReExports(
  namespace: string,
  generators: string[],
  artifactsByGenerator: Record<string, GeneratorArtifact>,
  logger: Logger,
): void {
  const owners = new Map<string, string[]>();

  for (const name of generators) {
    const artifact = artifactsByGenerator[name];
    if (!artifact) {
      continue;
    }
    const identifiers = new Set<string>();
    for (const [key, entity] of Object.entries(artifact.entities)) {
      const dot = key.indexOf('.');
      const entityNamespace = dot === -1 ? key : key.slice(0, dot);
      if (entityNamespace !== namespace) {
        continue;
      }
      for (const identifier of Object.values(entity.symbols)) {
        identifiers.add(identifier);
      }
    }
    for (const identifier of identifiers) {
      const list = owners.get(identifier) ?? [];
      list.push(name);
      owners.set(identifier, list);
    }
  }

  for (const [identifier, list] of owners) {
    if (list.length > 1) {
      const sorted = [...list].sort();
      logger.warn(
        `namespace '${namespace}': identifier '${identifier}' is re-exported by generators [${sorted.join(
          ', ',
        )}]; the ambiguous star re-export from '${namespace}/index.ts' will be dropped. Import it from a generator subpath instead.`,
        { namespace, identifier, generators: sorted },
      );
    }
  }
}
