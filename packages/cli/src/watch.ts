/**
 * `tako generate --watch` — a chokidar loop around `loadConfig()` + `run()`.
 * Full regeneration on every change (no incremental). A 100 ms trailing
 * debounce coalesces bursts; a change mid-cycle aborts the in-flight `run()`
 * (via `RunOptions.signal`) and re-runs once it settles. `loadConfig` failures
 * are reported, not fatal — the watcher stays up on `tako.config.ts`.
 *
 * `backlog/features/cli/technical.md` §Watch mode.
 */
import { basename, resolve } from 'node:path';
import {
  type LoadResult,
  loadConfig as realLoadConfig,
} from '@kurotako/config';
import { run as realRun, TakoError } from '@kurotako/core';
import chokidar from 'chokidar';
import { renderError } from './errors.js';
import type { ConsoleReporter } from './reporter.js';

/** Minimal watcher seam so the loop is unit-testable without touching the fs. */
export interface Watcher {
  add(paths: string | readonly string[]): void;
  unwatch(paths: string | readonly string[]): void;
  on(handler: (event: string, path: string) => void): void;
  close(): Promise<void>;
}

export interface WatchAndRunOptions {
  cwd: string;
  configPath?: string;
  reporter: ConsoleReporter;
}

export interface WatchDeps {
  createWatcher: () => Watcher;
  loadConfig: typeof realLoadConfig;
  run: typeof realRun;
  debounceMs: number;
}

const DEBOUNCE_MS = 100;

function chokidarWatcher(): Watcher {
  const fsw = chokidar.watch([], {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 20 },
  });
  return {
    add: (paths) => fsw.add(paths as string | string[]),
    unwatch: (paths) => fsw.unwatch(paths as string | string[]),
    on: (handler) => {
      fsw.on('add', (p) => handler('add', p));
      fsw.on('change', (p) => handler('change', p));
      fsw.on('unlink', (p) => handler('unlink', p));
    },
    close: () => fsw.close(),
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Runs until `SIGINT` / `SIGTERM`, then closes the watcher and resolves so the
 * caller can exit 0. (The design doc types this `Promise<never>`; it resolves
 * on shutdown here purely so it stays testable.)
 */
export async function watchAndRun(
  opts: WatchAndRunOptions,
  deps: Partial<WatchDeps> = {},
): Promise<void> {
  const { cwd, configPath, reporter } = opts;
  const createWatcher = deps.createWatcher ?? chokidarWatcher;
  const loadConfig = deps.loadConfig ?? realLoadConfig;
  const run = deps.run ?? realRun;
  const debounceMs = deps.debounceMs ?? DEBOUNCE_MS;

  const watcher = createWatcher();
  let watched = new Set<string>();
  let inFlight: AbortController | null = null;
  let queued = false;
  let closed = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let reason = 'initial build';

  const guessedConfigFile = configPath
    ? resolve(cwd, configPath)
    : resolve(cwd, 'tako.config.ts');

  function applyWatchSet(desired: Set<string>): void {
    for (const path of desired) {
      if (!watched.has(path)) {
        watcher.add(path);
      }
    }
    for (const path of watched) {
      if (!desired.has(path)) {
        watcher.unwatch(path);
      }
    }
    watched = desired;
  }

  async function reconcileWatchSet(loaded: LoadResult): Promise<void> {
    const desired = new Set<string>([loaded.configFile]);
    for (const [namespace, source] of Object.entries(loaded.config.sources)) {
      const paths =
        (await source.parser.watchPaths?.({
          namespace,
          cwd: loaded.rootDir,
          logger: reporter,
        })) ?? [];
      for (const path of paths) {
        desired.add(resolve(loaded.rootDir, path));
      }
    }
    applyWatchSet(desired);
  }

  async function cycle(): Promise<void> {
    const why = reason;
    reporter.info(`--- rebuild (${why}) ---`);
    const ac = new AbortController();
    inFlight = ac;
    try {
      const loaded = await loadConfig({ cwd, configPath });
      await reconcileWatchSet(loaded);
      const result = await run(loaded.config, {
        logger: reporter,
        signal: ac.signal,
        write: true,
      });
      if (!ac.signal.aborted) {
        reporter.info(`wrote ${result.files.length} files`);
      }
    } catch (error) {
      if (isAbortError(error) || ac.signal.aborted) {
        // Superseded by a newer cycle — swallow.
      } else if (error instanceof TakoError) {
        reporter.error(renderError(error));
        // Keep watching at least the config file so a fix is picked up.
        applyWatchSet(new Set([...watched, guessedConfigFile]));
      } else {
        reporter.error('internal error (this is a bug):');
        console.error(error);
      }
    } finally {
      inFlight = null;
      if (queued && !closed) {
        queued = false;
        await cycle();
      }
    }
  }

  function trigger(): void {
    if (inFlight) {
      queued = true;
      inFlight.abort();
      return;
    }
    void cycle();
  }

  function schedule(event: string, path: string): void {
    if (closed) {
      return;
    }
    reason = `${basename(path)} ${event === 'unlink' ? 'removed' : 'changed'}`;
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      timer = null;
      trigger();
    }, debounceMs);
  }

  watcher.on(schedule);

  // Initial cycle: a failure is reported inside `cycle()`, never fatal.
  applyWatchSet(new Set([guessedConfigFile]));
  await cycle();
  reporter.info(`watching ${watched.size} paths`);

  await new Promise<void>((resolvePromise) => {
    const shutdown = () => {
      closed = true;
      if (timer) {
        clearTimeout(timer);
      }
      inFlight?.abort();
      process.off('SIGINT', shutdown);
      process.off('SIGTERM', shutdown);
      void watcher.close().finally(() => resolvePromise());
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  });
}
