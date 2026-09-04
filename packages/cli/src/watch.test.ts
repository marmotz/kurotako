import { ConfigNotFoundError } from '@kurotako/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConsoleReporter } from './reporter.js';
import { type WatchDeps, type Watcher, watchAndRun } from './watch.js';

/** A hand-driven `Watcher`: tests emit events; assertions read `paths`. */
function fakeWatcher() {
  let handler: (event: string, path: string) => void = () => {};
  const paths = new Set<string>();
  let closed = false;
  const watcher: Watcher = {
    add: (p) => {
      for (const x of ([] as string[]).concat(p as string)) {
        paths.add(x);
      }
    },
    unwatch: (p) => {
      for (const x of ([] as string[]).concat(p as string)) {
        paths.delete(x);
      }
    },
    on: (h) => {
      handler = h;
    },
    close: async () => {
      closed = true;
    },
  };
  return {
    watcher,
    paths,
    emit: (event: string, path: string) => handler(event, path),
    get closed() {
      return closed;
    },
  };
}

function loadResult(sources: Record<string, unknown> = {}) {
  return {
    config: {
      rootDir: '/proj',
      sources,
      generators: {},
      outputs: [{ mode: 'dir' as const, dir: '/proj/out' }],
    },
    configFile: '/proj/tako.config.ts',
    rootDir: '/proj',
  };
}

const runResult = {
  ir: {},
  order: [],
  files: [],
  artifacts: {},
  written: [],
};

let reporter: ConsoleReporter;
let fw: ReturnType<typeof fakeWatcher>;
let loadConfig: ReturnType<typeof vi.fn>;
let run: ReturnType<typeof vi.fn>;

// A permanent SIGINT listener so an unhandled emit never terminates the runner.
const keepAlive = () => {};

function start() {
  const deps: Partial<WatchDeps> = {
    createWatcher: () => fw.watcher,
    loadConfig: loadConfig as unknown as WatchDeps['loadConfig'],
    run: run as unknown as WatchDeps['run'],
    debounceMs: 5,
  };
  return watchAndRun({ cwd: '/proj', reporter }, deps);
}

beforeEach(() => {
  process.on('SIGINT', keepAlive);
  process.on('SIGTERM', keepAlive);
  reporter = new ConsoleReporter({
    stream: { write: () => true },
    color: false,
  });
  fw = fakeWatcher();
  loadConfig = vi.fn().mockResolvedValue(loadResult());
  run = vi.fn().mockResolvedValue(runResult);
});

afterEach(async () => {
  process.emit('SIGINT');
  await tick();
  process.off('SIGINT', keepAlive);
  process.off('SIGTERM', keepAlive);
});

const tick = () => new Promise((r) => setTimeout(r, 20));

describe('watchAndRun', () => {
  it('runs one initial cycle and reports the watch set', async () => {
    void start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(fw.paths.has('/proj/tako.config.ts')).toBe(true);
  });

  it('a single change triggers exactly one rebuild after the debounce', async () => {
    void start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    fw.emit('change', '/proj/schema.prisma');
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a burst of events collapses into one rebuild', async () => {
    void start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    for (let i = 0; i < 5; i++) {
      fw.emit('change', '/proj/schema.prisma');
    }
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    await tick();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('a change mid-run aborts the in-flight run then runs again', async () => {
    let firstSignal: AbortSignal | undefined;
    run.mockImplementationOnce(
      (_cfg: unknown, opts: { signal: AbortSignal }) => {
        firstSignal = opts.signal;
        return new Promise((_res, rej) => {
          opts.signal.addEventListener('abort', () => {
            const e = new Error('aborted');
            e.name = 'AbortError';
            rej(e);
          });
        });
      },
    );
    void start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    fw.emit('change', '/proj/schema.prisma');
    await vi.waitFor(() => {
      expect(firstSignal?.aborted).toBe(true);
      expect(run).toHaveBeenCalledTimes(2);
    });
  });

  it('survives a loadConfig failure and recovers when it loads again', async () => {
    loadConfig.mockRejectedValueOnce(
      new ConfigNotFoundError('no tako.config.ts'),
    );
    void start();
    await vi.waitFor(() => expect(loadConfig).toHaveBeenCalledTimes(1));
    expect(fw.paths.has('/proj/tako.config.ts')).toBe(true);
    expect(run).not.toHaveBeenCalled();

    fw.emit('change', '/proj/tako.config.ts');
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  });

  it('extends and shrinks the watch set as sources change', async () => {
    loadConfig.mockResolvedValueOnce(
      loadResult({
        pg: { parser: { name: 'p', watchPaths: () => ['schema.prisma'] } },
      }),
    );
    void start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(fw.paths.has('/proj/schema.prisma')).toBe(true);

    loadConfig.mockResolvedValue(loadResult({}));
    fw.emit('change', '/proj/schema.prisma');
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(fw.paths.has('/proj/schema.prisma')).toBe(false);
  });

  it('SIGINT closes the watcher and resolves', async () => {
    const done = start();
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    process.emit('SIGINT');
    await done;
    expect(fw.closed).toBe(true);
  });
});
