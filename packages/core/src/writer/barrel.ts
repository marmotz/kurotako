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

    for (const [identifier, owners] of collisions) {
      logger?.warn(
        `namespace '${namespace}': identifier '${identifier}' is re-exported by generators [${owners.join(
          ', ',
        )}]; '${namespace}/index.ts' explicitly re-exports it from '${owners[0]}'. Import a generator subpath to select another declaration.`,
        { namespace, identifier, generators: owners },
      );
    }
    barrels.push({ path: `${namespace}/index.ts`, content });
  }

  return barrels;
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
