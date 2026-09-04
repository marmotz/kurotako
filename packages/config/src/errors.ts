/**
 * `@kurotako/config` error hierarchy. Every class extends `TakoError` from
 * `@kurotako/core` so the CLI's single `catch (e) if (e instanceof TakoError)`
 * covers config failures too. Codes are namespaced `config_*` /
 * `driver_options_*`.
 *
 * The carrying errors reuse core's `IrValidationError` convention:
 * `issues: { path: string; message: string }[]`.
 *
 * Error table: `backlog/features/config-system/technical.md` §Errors.
 */
import { TakoError } from '@kurotako/core';

export interface ConfigIssue {
  path: string;
  message: string;
}

/** No `tako.config.ts` up the tree, or an explicit `--config` path is missing. */
export class ConfigNotFoundError extends TakoError {
  readonly triedPaths: string[];

  constructor(message: string, triedPaths: string[] = []) {
    super('config_not_found', message);
    this.triedPaths = triedPaths;
  }
}

/** `jiti` threw while importing the config file (syntax error, missing driver…). */
export class ConfigLoadError extends TakoError {
  readonly configFile: string;

  constructor(configFile: string, options?: { cause?: unknown }) {
    super(
      'config_load_error',
      `failed to load the config file '${configFile}'`,
      options,
    );
    this.configFile = configFile;
  }
}

/** The config module has no usable default export. */
export class NoDefaultExportError extends TakoError {
  readonly configFile: string;

  constructor(configFile: string) {
    super(
      'config_no_default_export',
      `the config file '${configFile}' has no default export`,
    );
    this.configFile = configFile;
  }
}

/** `TakoConfigSchema` or a cross-field check failed. Carries located issues. */
export class ConfigShapeError extends TakoError {
  readonly issues: ConfigIssue[];

  constructor(issues: ConfigIssue[]) {
    const detail = issues
      .map((i) => `${i.path === '' ? '<root>' : i.path}: ${i.message}`)
      .join('; ');
    super('config_invalid', `invalid config: ${detail}`);
    this.issues = issues;
  }
}

/** Two `generators[]` entries share `use.name`. */
export class DuplicateGeneratorError extends TakoError {
  readonly generator: string;

  constructor(generator: string) {
    super(
      'config_duplicate_generator',
      `two generator entries share the name '${generator}'`,
    );
    this.generator = generator;
  }
}

/** A `namespaces` allowlist names a namespace absent from `sources`. */
export class UnknownNamespaceError extends TakoError {
  readonly namespace: string;
  readonly generator: string;

  constructor(generator: string, namespace: string) {
    super(
      'config_unknown_namespace',
      `generator '${generator}' restricts to namespace '${namespace}', which is not declared in sources`,
    );
    this.namespace = namespace;
    this.generator = generator;
  }
}

/** An `outputs[i].generators` allowlist names a generator absent from `generators`. */
export class UnknownGeneratorError extends TakoError {
  readonly outputIndex: number;
  readonly generator: string;

  constructor(outputIndex: number, generator: string) {
    super(
      'config_unknown_generator',
      `outputs[${outputIndex}] restricts to generator '${generator}', which is not declared in generators`,
    );
    this.outputIndex = outputIndex;
    this.generator = generator;
  }
}

/** An entry's `options` failed `use.optionsSchema` (or was passed unexpectedly). */
export class DriverOptionsError extends TakoError {
  readonly role: 'parser' | 'generator';
  readonly driverName: string;
  readonly namespace?: string;
  readonly issues: ConfigIssue[];

  constructor(
    role: 'parser' | 'generator',
    driverName: string,
    issues: ConfigIssue[],
    namespace?: string,
  ) {
    const where = namespace ? ` (namespace '${namespace}')` : '';
    const detail = issues
      .map((i) => `${i.path === '' ? '<root>' : i.path}: ${i.message}`)
      .join('; ');
    super(
      'driver_options_invalid',
      `invalid options for ${role} '${driverName}'${where}: ${detail}`,
    );
    this.role = role;
    this.driverName = driverName;
    this.namespace = namespace;
    this.issues = issues;
  }
}
