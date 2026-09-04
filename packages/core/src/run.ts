/**
 * `run()` — the single public entry point. Sequential, fail-fast: parse ->
 * merge -> order -> generate -> collect -> write -> afterEmit. `opts.signal` is
 * checked at each step boundary; `opts.write === false` runs everything but
 * skips the Writer (basis of `--dry-run` and `drift-guard`).
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
  ResolvedConfig,
  RunOptions,
  RunResult,
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

  // 6. Write (unless disabled).
  let writtenPaths: string[] | undefined;
  if (opts?.write !== false) {
    checkSignal();
    const writer = selectWriter(config.output);
    writtenPaths = await writer.write({
      files,
      output: config.output,
      artifacts,
      logger,
    });
  }

  // 7. afterEmit — only after a real write.
  if (writtenPaths) {
    checkSignal();
    const outputDir =
      (config.output.mode === 'package'
        ? config.output.packagesDir
        : config.output.dir) ?? config.rootDir;
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

  return { ir, order, files, artifacts };
}
