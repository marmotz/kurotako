/**
 * CLI-owned error(s) and `renderError()` — the single formatter the top-level
 * handler in `cli.ts` uses for any `TakoError` (from `@kurotako/core`,
 * `@kurotako/config`, or this package).
 *
 * `backlog/features/cli/technical.md` §Errors and exit codes.
 */
import { TakoError } from '@kurotako/core';

/** `tako init` refuses to overwrite an existing config unless `--force`. */
export class ConfigExistsError extends TakoError {
  readonly path: string;

  constructor(path: string) {
    super(
      'config_exists',
      `a config file already exists at '${path}' (pass --force to overwrite)`,
    );
    this.path = path;
  }
}

interface Issue {
  path?: string;
  message?: string;
}

/**
 * `error [<code>]: <message>` plus any carried context on its own indented
 * lines: located issues (`ConfigShapeError`, `IrValidationError`,
 * `DriverOptionsError`), the offending driver / namespace (`DriverError`,
 * `UnknownNamespaceError`), the dependency cycle path (`DependencyCycleError`),
 * and the `cause` message of a wrapped failure.
 */
export function renderError(error: TakoError): string {
  const lines = [`error [${error.code}]: ${error.message}`];

  const issues = (error as { issues?: unknown }).issues;
  if (Array.isArray(issues)) {
    for (const issue of issues as Issue[]) {
      const at =
        issue.path === undefined || issue.path === '' ? '<root>' : issue.path;
      lines.push(`  - ${at}: ${issue.message}`);
    }
  }

  const cycle = (error as { cycle?: unknown }).cycle;
  if (Array.isArray(cycle) && cycle.length > 0) {
    lines.push(`  cycle: ${(cycle as string[]).join(' -> ')}`);
  }

  const driverName = (error as { driverName?: unknown }).driverName;
  if (typeof driverName === 'string') {
    const role = (error as { role?: unknown }).role;
    const namespace = (error as { namespace?: unknown }).namespace;
    const roleLabel = typeof role === 'string' ? role : 'driver';
    const where =
      typeof namespace === 'string' ? ` (namespace '${namespace}')` : '';
    lines.push(`  ${roleLabel}: ${driverName}${where}`);
  } else {
    const generator = (error as { generator?: unknown }).generator;
    if (typeof generator === 'string') {
      const namespace = (error as { namespace?: unknown }).namespace;
      const where =
        typeof namespace === 'string' ? ` (namespace '${namespace}')` : '';
      lines.push(`  generator: ${generator}${where}`);
    }
  }

  // Wrapped failures (`DriverError`, `HookError`, `ConfigLoadError`, …) carry the
  // real error in `cause`; core masks its type, so surface at least its message.
  const cause = error.cause;
  if (cause !== undefined && cause !== null) {
    const message = cause instanceof Error ? cause.message : String(cause);
    const code = cause instanceof TakoError ? ` [${cause.code}]` : '';
    lines.push(`  cause${code}: ${message}`);
  }

  return lines.join('\n');
}
