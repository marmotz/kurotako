/**
 * `run()` — the single public entry point. Sequential, fail-fast: parse ->
 * merge -> order -> generate -> collect -> write -> afterEmit. `opts.signal` is
 * checked at each step boundary; `opts.write === false` runs everything but
 * skips the Writer (basis of `--dry-run`). `opts.plan === true` also stops
 * before emission but calls `Writer.plan()` per output and returns the planned
 * tree as `RunResult.plan` — no disk I/O, no `afterEmit` (basis of `tako check`
 * / drift-guard); it wins over `opts.write`.
 *
 * Steps 5b/5c (synthesize root barrels, apply banner) are added to this file by
 * the output-modes feature; they are not part of the core-pipeline tasks.
 */

import type { GeneratorTree } from './collect.js';
import { mergeTrees } from './collect.js';
import { DriverError, HookError } from './errors.js';
import { filterIR } from './filter.js';
import { generatorOrder } from './graph.js';
import { childLogger, noopLogger } from './logger.js';
import type { MergeEntry } from './merge.js';
import { mergeSources } from './merge.js';
import type {
  GeneratorArtifact,
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
    const ctx = {
      namespace,
      cwd: config.rootDir,
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
  const ir = mergeSources(entries);

  // 3. Order.
  checkSignal();
  const order = generatorOrder(config.generators);

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

    const declared = [
      ...(generator.dependsOn ?? []),
      ...(generator.optionalDependsOn ?? []),
    ];
    const dependencies: Record<string, GeneratorArtifact> = {};
    for (const dep of declared) {
      const artifact = artifacts[dep];
      if (artifact) {
        dependencies[dep] = artifact;
      }
    }

    try {
      const out = await generator.generate({
        ir: view,
        dependencies,
        logger: childLogger(logger, { generator: name }),
      });
      artifacts[name] = out.artifact;
      perGenerator.push({ generator: name, files: out.files });
    } catch (error) {
      if (error instanceof DriverError) {
        throw error;
      }
      throw new DriverError('generator', generator.name, { cause: error });
    }
  }

  // 5. Collect.
  checkSignal();
  const collected = mergeTrees(perGenerator);

  // 5b. Synthesize the per-namespace root barrels and fold them into the tree.
  // A generator that emitted `<ns>/index.ts` itself now collides with the
  // synthesized file → OutputCollisionError pointing at the prefix rule.
  checkSignal();
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
    const outputBarrels = synthesizeRootBarrels(
      filteredFiles,
      artifacts,
      logger,
    );
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
