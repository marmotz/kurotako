/**
 * `ConsoleReporter` — the `@kurotako/core` `Logger` the CLI injects into
 * `loadConfig()` / `run()`, plus the per-phase / summary output.
 *
 * Contract (`backlog/features/cli/technical.md` §Reporter):
 * - human output goes to **stderr**, `stdout` stays clean;
 * - `info` / `warn` / `error` shown by default; `debug` only with `--debug` /
 *   `TAKO_DEBUG` (a hidden flag, not advertised);
 * - `tako ` prefix, level-coloured; colour auto-off when the stream is not a TTY
 *   or `NO_COLOR` is set;
 * - `child(tag)` returns a `Logger` tagging every `meta` with `{ scope: tag }`.
 */
import { childLogger, type Logger } from '@kurotako/core';

type Level = 'debug' | 'info' | 'warn' | 'error';

/** The slice of a writable stream the reporter needs (keeps tests trivial). */
export interface WriteStream {
  write(chunk: string): unknown;
  isTTY?: boolean;
}

export interface ConsoleReporterOptions {
  /** Show `debug` output. Default: `false` unless `TAKO_DEBUG` is set. */
  debug?: boolean;
  /** Sink for human output. Default: `process.stderr`. */
  stream?: WriteStream;
  /** Force colour on/off. Default: auto (TTY and no `NO_COLOR`). */
  color?: boolean;
}

const ESC = String.fromCharCode(27);
const ANSI: Record<Level, string> = {
  debug: `${ESC}[2m`, // dim
  info: `${ESC}[36m`, // cyan
  warn: `${ESC}[33m`, // yellow
  error: `${ESC}[31m`, // red
};
const ANSI_RESET = `${ESC}[0m`;

export class ConsoleReporter implements Logger {
  private readonly stream: WriteStream;
  private readonly showDebug: boolean;
  private readonly color: boolean;

  constructor(options: ConsoleReporterOptions = {}) {
    this.stream = options.stream ?? process.stderr;
    this.showDebug = options.debug ?? Boolean(process.env.TAKO_DEBUG);
    this.color =
      options.color ??
      (Boolean(this.stream.isTTY) && process.env.NO_COLOR === undefined);
  }

  debug(msg: string, meta?: unknown): void {
    if (this.showDebug) {
      this.write('debug', msg, meta);
    }
  }

  info(msg: string, meta?: unknown): void {
    this.write('info', msg, meta);
  }

  warn(msg: string, meta?: unknown): void {
    this.write('warn', msg, meta);
  }

  error(msg: string, meta?: unknown): void {
    this.write('error', msg, meta);
  }

  /** A child `Logger` whose calls carry `{ scope: tag }` in `meta`. */
  child(tag: string): Logger {
    return childLogger(this, { scope: tag });
  }

  private write(level: Level, msg: string, meta?: unknown): void {
    const prefix = this.color ? `${ANSI[level]}tako${ANSI_RESET}` : 'tako';
    const detail = meta === undefined ? '' : ` ${formatMeta(meta)}`;
    this.stream.write(`${prefix} ${msg}${detail}\n`);
  }
}

function formatMeta(meta: unknown): string {
  if (meta !== null && typeof meta === 'object' && !Array.isArray(meta)) {
    return Object.entries(meta as Record<string, unknown>)
      .map(([k, v]) => `${k}=${stringify(v)}`)
      .join(' ');
  }
  return stringify(meta);
}

function stringify(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
