/**
 * `run()` — the single public entry point. Sequential, fail-fast: parse ->
 * merge -> generate (declaration order) -> collect -> write -> afterEmit. `opts.signal` is
 * checked at each step boundary; `opts.write === false` runs everything but
 * skips the Writer (basis of `--dry-run`). `opts.plan === true` also stops
 * before emission but calls `Writer.plan()` per output and returns the planned
 * tree as `RunResult.plan` — no disk I/O, no `afterEmit` (basis of `tako check`
 * / drift-guard); it wins over `opts.write`.
 *
 * Steps 5b/5c (synthesize root barrels, apply banner) are added to this file by
 * the output-modes feature; they are not part of the core-pipeline tasks.
 */

import path from 'node:path';
import type { IR } from '@kurotako/ir';
import { refCycleMembers } from '@kurotako/ir';
import type { GeneratorTree } from './collect.js';
import { mergeTrees } from './collect.js';
import {
  DriverError,
  HookError,
  OutputPeerConflictError,
  SegmentViolationError,
} from './errors.js';
import { filterIR } from './filter.js';
import { childLogger, noopLogger } from './logger.js';
import type { MergeEntry } from './merge.js';
import { mergeSources } from './merge.js';
import type {
  Generator,
  GeneratorArtifact,
  GenOutput,
  Logger,
  OutputConfig,
  PlannedFile,
  ResolvedConfig,
  RunOptions,
  RunResult,
  VirtualFile,
} from './types.js';
import { applyBanner } from './writer/banner.js';
import { synthesizeRootBarrels } from './writer/barrel.js';
import { selectWriter } from './writer/index.js';

export async function run(
  config: ResolvedConfig,
  opts?: RunOptions,
): Promise<RunResult> {
  const logger = opts?.logger ?? noopLogger;
  const checkSignal = () => opts?.signal?.throwIfAborted();

  checkSignal();

  // 1. Parse — sorted-namespace order for determinism.
  const entries: MergeEntry[] = [];
  for (const namespace of Object.keys(config.sources).sort()) {
    checkSignal();
    const source = config.sources[namespace];
    if (!source) {
      continue;
    }
    const { parser } = source;
    const anchorDir = (await parser.anchor?.(config.rootDir)) ?? config.rootDir;
    const ctx = {
      namespace,
      cwd: config.rootDir,
      anchorDir,
      logger: childLogger(logger, { namespace }),
    };
    try {
      const sourceIR = await parser.parse(ctx);
      entries.push({ namespace, sourceIR });
    } catch (error) {
      if (error instanceof DriverError) {
        throw error;
      }
      throw new DriverError('parser', parser.name, { cause: error, namespace });
    }
  }

  // 2. Merge.
  checkSignal();
  const ir = mergeSources(entries, logger);
  const cycles = new Set<string>();
  for (const [namespace, source] of Object.entries(ir.sources)) {
    for (const member of refCycleMembers(source)) {
      cycles.add(`${namespace}.${member}`);
    }
  }

  // 3. Order — declaration order. Generators no longer constrain each other:
  // a dependency is a private instance run for its dependent alone (step 4).
  checkSignal();
  const order = Object.keys(config.generators);

  // 4. Generate.
  const artifacts: Record<string, GeneratorArtifact> = {};
  const perGenerator: GeneratorTree[] = [];
  for (const name of order) {
    checkSignal();
    const cfg = config.generators[name];
    if (!cfg) {
      continue;
    }
    const { generator } = cfg;
    const view = filterIR(ir, cfg.namespaces);
    const out = await runGenerator(generator, {
      segment: generator.name,
      view,
      cycles,
      logger: childLogger(logger, { generator: name }),
      loggerBase: logger,
      checkSignal,
    });
    artifacts[name] = out.artifact;
    perGenerator.push({ generator: name, files: out.files });
  }

  // 5. Collect.
  checkSignal();
  const collected = mergeTrees(perGenerator);

  // 5b. Synthesize the per-namespace root barrels and fold them into the tree.
  // A generator that emitted `<ns>/index.ts` itself now collides with the
  // synthesized file → OutputCollisionError pointing at the prefix rule.
  checkSignal();
  // The aggregate tree covers every generator, so it is the single place the
  // ambiguous-export warnings are emitted. Per-output trees below select a
  // generator subset (a subset of these collisions) and stay silent.
  const barrels = synthesizeRootBarrels(collected, artifacts, logger);
  const merged = mergeTrees(
    [
      ...perGenerator,
      { generator: '<synthesized root barrel>', files: barrels },
    ],
    {
      collisionHint:
        "each generator must emit under its own '<namespace>/<generatorName>/' sub-tree; '<namespace>/index.ts' is synthesized by tako",
    },
  );

  // 5c. Prepend the generated-file banner once, covering generator output and
  // synthesized barrels alike.
  const files = applyBanner(merged);

  // The per-output tree: `collected` filtered to that output's generator subset,
  // with its own synthesized root barrels and the banner applied. Shared by the
  // write path (step 6) and the plan path (drift-guard).
  const outputTree = (output: OutputConfig): VirtualFile[] => {
    const names = new Set(output.generators ?? order);
    const filteredFiles = collected.filter((file) =>
      names.has(file.path.split('/')[1] ?? ''),
    );
    const outputBarrels = synthesizeRootBarrels(filteredFiles, artifacts);
    return applyBanner(
      mergeTrees([
        { generator: '<filtered>', files: filteredFiles },
        { generator: '<synthesized root barrel>', files: outputBarrels },
      ]),
    );
  };

  // 6a. Plan (drift-guard) — compute what a `generate` would write for every
  // output, without touching disk and without firing `afterEmit`. Wins over
  // `write`.
  if (opts?.plan === true) {
    const planned: PlannedFile[] = [];
    for (const output of config.outputs) {
      checkSignal();
      const writer = selectWriter(output);
      planned.push(
        ...(await writer.plan({
          files: outputTree(output),
          output,
          artifacts,
          logger,
        })),
      );
    }
    planned.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return { ir, order, files, artifacts, written: [], plan: planned };
  }

  // 6. Write (unless disabled) — one writer call per `config.outputs` entry.
  const written: { output: OutputConfig; files: string[] }[] = [];
  if (opts?.write !== false) {
    for (const output of config.outputs) {
      checkSignal();
      const writer = selectWriter(output);
      const writtenPaths = await writer.write({
        files: outputTree(output),
        output,
        artifacts,
        logger,
      });
      written.push({ output, files: writtenPaths });

      // 7. afterEmit — once per output, right after that output is written.
      checkSignal();
      const outputDir =
        (output.mode === 'package' ? output.packagesDir : output.dir) ??
        config.rootDir;
      try {
        await config.hooks?.afterEmit?.({
          outputDir,
          files: writtenPaths,
          logger,
        });
      } catch (error) {
        throw new HookError('afterEmit', { cause: error });
      }
    }
  }

  return { ir, order, files, artifacts, written };
}

interface GeneratorRunEnv {
  /** `generator.name` at the top level, `<parent segment>/<name>` when private. */
  segment: string;
  /** Namespace-filtered IR, shared by a generator and all its private instances. */
  view: IR;
  cycles: Set<string>;
  logger: Logger;
  /** Un-tagged logger, the base for private instances' own child loggers. */
  loggerBase: Logger;
  checkSignal: () => void;
  /** Set for a private instance: the generator that owns it. */
  dependencyOf?: string;
}

/**
 * Run `generator` after each of its private dependencies (recursively). Every
 * private instance gets the same namespace-filtered view as its dependent and the
 * nested segment `<segment>/<dep.name>`; its files are appended to the dependent's
 * own, its artifact is handed over as `ctx.dependencies[dep.name]`, and its peers
 * are merged into the dependent's artifact.
 */
async function runGenerator(
  generator: Generator,
  env: GeneratorRunEnv,
): Promise<GenOutput> {
  const { segment, view } = env;
  const dependencies: Record<string, GeneratorArtifact> = {};
  const privateFiles: VirtualFile[] = [];
  const privateArtifacts: [string, GeneratorArtifact][] = [];

  for (const dep of generator.dependsOn ?? []) {
    env.checkSignal();
    const out = await runGenerator(dep, {
      ...env,
      segment: `${segment}/${dep.name}`,
      logger: childLogger(env.loggerBase, {
        generator: dep.name,
        dependencyOf: generator.name,
      }),
      dependencyOf: generator.name,
    });
    dependencies[dep.name] = out.artifact;
    privateFiles.push(...out.files);
    privateArtifacts.push([dep.name, out.artifact]);
  }

  let out: GenOutput;
  try {
    out = await generator.generate({
      ir: view,
      dependencies,
      cycles: env.cycles,
      segment,
      logger: env.logger,
    });
  } catch (error) {
    if (error instanceof DriverError) {
      throw error;
    }
    throw new DriverError('generator', generator.name, {
      cause: error,
      dependencyOf: env.dependencyOf,
    });
  }

  if (env.dependencyOf !== undefined) {
    assertInSegment(generator.name, out.files, view, segment);
  }

  return {
    files: [...out.files, ...privateFiles],
    artifact: mergePeers(generator.name, out.artifact, privateArtifacts),
  };
}

/**
 * A private instance must emit under `<namespace>/<segment>/` for a namespace of
 * its view; anything else would land outside its dependent's sub-tree.
 */
function assertInSegment(
  name: string,
  files: VirtualFile[],
  view: IR,
  segment: string,
): void {
  const namespaces = Object.keys(view.sources);
  for (const file of files) {
    const normalized = path.posix.normalize(file.path.replace(/\\/g, '/'));
    if (!namespaces.some((ns) => normalized.startsWith(`${ns}/${segment}/`))) {
      throw new SegmentViolationError(
        name,
        file.path,
        `<namespace>/${segment}/`,
      );
    }
  }
}

/**
 * Union of the dependent's own `peerDependencies` with each private dependency's.
 * Identical ranges de-duplicate; the same package with two ranges throws
 * `OutputPeerConflictError` naming the two owners.
 */
function mergePeers(
  dependent: string,
  artifact: GeneratorArtifact,
  privateArtifacts: [string, GeneratorArtifact][],
): GeneratorArtifact {
  if (privateArtifacts.every(([, a]) => a.peerDependencies === undefined)) {
    return artifact;
  }
  const merged = new Map<string, { range: string; owner: string }>();
  const sources: [string, GeneratorArtifact][] = [
    [dependent, artifact],
    ...privateArtifacts,
  ];
  for (const [owner, source] of sources) {
    for (const [pkg, range] of Object.entries(source.peerDependencies ?? {})) {
      const existing = merged.get(pkg);
      if (existing && existing.range !== range) {
        throw new OutputPeerConflictError(
          undefined,
          pkg,
          [existing.range, range],
          [existing.owner, owner],
          dependent,
        );
      }
      if (!existing) {
        merged.set(pkg, { range, owner });
      }
    }
  }
  return {
    ...artifact,
    peerDependencies: Object.fromEntries(
      [...merged].map(([pkg, { range }]) => [pkg, range]),
    ),
  };
}
