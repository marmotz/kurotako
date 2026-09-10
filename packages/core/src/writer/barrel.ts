/**
 * Root-barrel synthesis. Each generator owns `<namespace>/<generatorName>/` and
 * emits its own barrel there; `tako` synthesizes `<namespace>/index.ts` so
 * `import … from '<scope>/<namespace>'` resolves regardless of how many
 * generators ran. Mode-independent — mode A and mode B both get the barrel.
 *
 * Design: `backlog/features/output-modes/technical.md` §New orchestration step.
 */
import path from 'node:path';
import * as ts from 'typescript';
import type { GeneratorArtifact, Logger, VirtualFile } from '../types.js';
import { contributingGenerators } from './tree.js';

/**
 * One `VirtualFile { path: '<ns>/index.ts' }` per namespace present in `files`,
 * its content one sorted `export * from './<generatorName>';` line per
 * generator that contributed a file under `<ns>/<generatorName>/`. A
 * single-generator namespace still gets a barrel.
 *
 * When generator barrels expose the same identifier, an explicit re-export
 * resolves the otherwise ambiguous star exports. The lexically first generator
 * owns the root name; every generator remains available from its own subpath.
 * Each namespace emits a single plain-language warning explaining the clash,
 * backed by a structured meta object for programmatic reporters or `--debug`.
 * Export names are read from the emitted TypeScript module graph, rather than
 * artifacts, because artifacts only describe dependency-facing entity symbols.
 */
export function synthesizeRootBarrels(
  files: VirtualFile[],
  _artifactsByGenerator?: Record<string, GeneratorArtifact>,
  logger?: Logger,
): VirtualFile[] {
  const contributors = contributingGenerators(files);
  const barrels: VirtualFile[] = [];

  for (const namespace of [...contributors.keys()].sort()) {
    const generators = contributors.get(namespace) ?? [];
    const collisions = exportedNameCollisions(namespace, generators, files);
    const content = [
      ...generators.map((name) => `export * from './${name}';`),
      ...[...collisions.entries()].map(
        ([identifier, owners]) =>
          `export { ${identifier} } from './${owners[0]}';`,
      ),
      '',
    ].join('\n');

    if (collisions.size > 0) {
      logger?.warn(
        formatCollisionWarning(namespace, generators, collisions),
        collisionMeta(namespace, generators, collisions),
      );
    }
    barrels.push({ path: `${namespace}/index.ts`, content });
  }

  return barrels;
}

/** How many colliding identifiers to name inline before summarizing the rest. */
const COLLISION_SAMPLE_SIZE = 5;

/**
 * Map each colliding identifier to the generator the synthesized barrel
 * re-exports it from (its lexically-first owner), in sorted identifier order.
 */
function collisionResolutions(
  collisions: Map<string, string[]>,
): Record<string, string> {
  const resolutions: Record<string, string> = {};
  for (const [identifier, owners] of collisions) {
    resolutions[identifier] = owners[0] as string;
  }
  return resolutions;
}

/** Join a list into readable prose: `a`, `a and b`, `a, b and c`. */
function listPhrase(items: string[]): string {
  if (items.length <= 1) {
    return items[0] ?? '';
  }
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * A multi-line, plain-language explanation for one namespace: what caused the
 * name clash, that it is not an error, which import gives which declaration,
 * and how to make the warning go away. The full per-identifier detail lives in
 * the meta object ({@link collisionMeta}) and is only printed with `--debug`.
 */
function formatCollisionWarning(
  namespace: string,
  generators: string[],
  collisions: Map<string, string[]>,
): string {
  const identifiers = [...collisions.keys()];
  const count = identifiers.length;
  const targets = [...new Set(Object.values(collisionResolutions(collisions)))];
  const primary = targets.length === 1 ? (targets[0] as string) : undefined;

  const shared =
    count === 1
      ? `a declaration named '${identifiers[0]}'`
      : `${count} identically-named declarations (for example '${identifiers[0]}')`;
  const kept = primary
    ? `keeps the one from '${primary}'`
    : 'keeps the one from whichever generator comes first alphabetically';

  const sample = identifiers.slice(0, COLLISION_SAMPLE_SIZE);
  const remainder = count - sample.length;
  const affected =
    remainder > 0
      ? `${sample.join(', ')} and ${remainder} more`
      : listPhrase(sample);

  return [
    `Name clash in namespace '${namespace}': ${listPhrase(generators)} each generate ${shared}.`,
    `The shared entry point '${namespace}' can expose only one declaration per name, so it ${kept}. Nothing is lost: every declaration stays reachable from its own generator's path.`,
    '',
    'This is not an error. Generation succeeded and the output is valid; this is the normal outcome when several generators describe the same model.',
    '',
    `To use a specific one, import from the generator's path instead of the namespace:`,
    ...generators.map(
      (name) =>
        `  import … from '${namespace}/${name}'${name === primary ? `   (same as '${namespace}')` : ''}`,
    ),
    `To silence this warning, point the output at a single generator (the 'generators' list in your output config).`,
    '',
    `Names affected (${count}): ${affected}.`,
  ].join('\n');
}

/** Structured counterpart of {@link formatCollisionWarning}. */
function collisionMeta(
  namespace: string,
  generators: string[],
  collisions: Map<string, string[]>,
): {
  namespace: string;
  generators: string[];
  collisionCount: number;
  identifiers: string[];
  sample: string[];
  resolutions: Record<string, string>;
} {
  const identifiers = [...collisions.keys()];
  return {
    namespace,
    generators,
    collisionCount: identifiers.length,
    identifiers,
    sample: identifiers.slice(0, COLLISION_SAMPLE_SIZE),
    resolutions: collisionResolutions(collisions),
  };
}

/** Return exported identifiers owned by more than one generator barrel. */
function exportedNameCollisions(
  namespace: string,
  generators: string[],
  files: VirtualFile[],
): Map<string, string[]> {
  const sourceFiles = new Map(
    files
      .filter((file) => file.path.startsWith(`${namespace}/`))
      .map((file) => [toVirtualPath(file.path), file.content]),
  );
  const rootNames = generators
    .map((generator) => toVirtualPath(`${namespace}/${generator}/index.ts`))
    .filter((fileName) => sourceFiles.has(fileName));
  if (rootNames.length < 2) {
    return new Map();
  }

  const options: ts.CompilerOptions = {
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    noLib: true,
  };
  const host = ts.createCompilerHost(options, true);
  host.fileExists = (fileName) => sourceFiles.has(fileName);
  host.readFile = (fileName) => sourceFiles.get(fileName);
  host.getSourceFile = (fileName, languageVersion) => {
    const text = sourceFiles.get(fileName);
    return text === undefined
      ? undefined
      : ts.createSourceFile(fileName, text, languageVersion, true);
  };
  host.directoryExists = (directoryName) =>
    [...sourceFiles.keys()].some((fileName) =>
      fileName.startsWith(`${directoryName}/`),
    );

  const program = ts.createProgram({ rootNames, options, host });
  const checker = program.getTypeChecker();
  const owners = new Map<string, string[]>();
  for (const generator of generators) {
    const source = program.getSourceFile(
      toVirtualPath(`${namespace}/${generator}/index.ts`),
    );
    if (!source) continue;
    const module = checker.getSymbolAtLocation(source);
    if (!module) continue;
    for (const exported of checker.getExportsOfModule(module)) {
      const list = owners.get(exported.name) ?? [];
      list.push(generator);
      owners.set(exported.name, list);
    }
  }

  return new Map(
    [...owners]
      .filter(([, owners]) => owners.length > 1)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function toVirtualPath(fileName: string): string {
  return path.posix.join('/', fileName);
}
