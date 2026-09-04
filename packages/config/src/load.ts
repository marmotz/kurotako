/**
 * `loadConfig` — resolve the config file, import it via `jiti`, structurally
 * validate it, run the cross-field checks, validate + curry each driver's
 * `options`, and build the `@kurotako/core` `ResolvedConfig`.
 *
 * `loadConfig` never touches the pipeline; the CLI calls it, then
 * `run(result.config, { logger })`.
 */
import { isAbsolute, resolve } from 'node:path';
import type {
  GeneratorConfig,
  OutputConfig,
  ResolvedConfig,
  SourceConfig,
} from '@kurotako/core';
import { createJiti } from 'jiti';
import * as v from 'valibot';
import {
  type ConfigIssue,
  ConfigLoadError,
  ConfigShapeError,
  DriverOptionsError,
  DuplicateGeneratorError,
  NoDefaultExportError,
  UnknownGeneratorError,
  UnknownNamespaceError,
} from './errors.js';
import { resolveConfigFile } from './resolve.js';
import { normalizeIssues, TakoConfigSchema } from './schema.js';
import type {
  GeneratorEntry,
  SourceEntry,
  TakoGenerator,
  TakoHooks,
  TakoParser,
} from './types.js';

const DEFAULT_OUTPUT_DIR = './generated/kurotako';

/** `${scope}/${namespace}` becomes the generated package.json `name`; no '/'. */
const NPM_SCOPE_RE = /^@[a-z0-9][a-z0-9._-]*$/;

export interface LoadResult {
  /** The `@kurotako/core` shape. */
  config: ResolvedConfig;
  /** Absolute path actually loaded. */
  configFile: string;
  /** `dirname(configFile)` — anchor for relative paths + parser cwd. */
  rootDir: string;
}

export async function loadConfig(opts?: {
  cwd?: string;
  configPath?: string;
}): Promise<LoadResult> {
  const configFile = resolveConfigFile({
    cwd: opts?.cwd ?? process.cwd(),
    configPath: opts?.configPath,
  });
  const rootDir = resolve(configFile, '..');

  const jiti = createJiti(rootDir, {
    interopDefault: true,
    moduleCache: false,
  });

  // Import the namespace (not `{ default: true }`): with `interopDefault` a file
  // with *no* default export still yields a synthetic one, so we detect the
  // real thing by inspecting the namespace for an actual `default` key.
  let ns: Record<string, unknown> | undefined;
  try {
    ns = (await jiti.import(configFile)) as Record<string, unknown> | undefined;
  } catch (cause) {
    throw new ConfigLoadError(configFile, { cause });
  }
  if (ns == null || !('default' in ns) || ns.default == null) {
    throw new NoDefaultExportError(configFile);
  }
  const mod = ns.default;

  const parsed = v.safeParse(TakoConfigSchema, mod);
  if (!parsed.success) {
    throw new ConfigShapeError(normalizeIssues(parsed.issues));
  }
  const config = parsed.output;

  // --- cross-field checks -----------------------------------------------------
  const generatorEntries = config.generators as unknown as GeneratorEntry[];
  const sourceEntries = Object.entries(config.sources) as unknown as [
    string,
    SourceEntry,
  ][];
  const sourceNamespaces = new Set(Object.keys(config.sources));

  const seenGenerators = new Set<string>();
  for (const entry of generatorEntries) {
    const name = entry.use.name;
    if (seenGenerators.has(name)) {
      throw new DuplicateGeneratorError(name);
    }
    seenGenerators.add(name);
    for (const ns of entry.namespaces ?? []) {
      if (!sourceNamespaces.has(ns)) {
        throw new UnknownNamespaceError(name, ns);
      }
    }
  }

  for (const [index, entry] of config.outputs.entries()) {
    for (const name of entry.generators ?? []) {
      if (!seenGenerators.has(name)) {
        throw new UnknownGeneratorError(index, name);
      }
    }
  }

  for (const [index, entry] of config.outputs.entries()) {
    const mode = entry.mode ?? 'dir';
    if (mode !== 'package') {
      continue;
    }
    const missing: ConfigIssue[] = [];
    if (entry.packagesDir === undefined) {
      missing.push({
        path: `outputs.${index}.packagesDir`,
        message: "required when outputs[].mode is 'package'",
      });
    }
    if (entry.scope === undefined) {
      missing.push({
        path: `outputs.${index}.scope`,
        message: "required when outputs[].mode is 'package'",
      });
    } else if (!NPM_SCOPE_RE.test(entry.scope)) {
      missing.push({
        path: `outputs.${index}.scope`,
        message: `'${entry.scope}' is not a valid npm scope: it must look like '@name' (letters, digits, '-', '.', '_' only — no '/'). Generated package names are '\${scope}/\${namespace}', so an extra '/' here would nest the generated package under a subdirectory instead of naming it.`,
      });
    }
    if (missing.length > 0) {
      throw new ConfigShapeError(missing);
    }
  }

  // --- per-driver options + currying ----------------------------------------
  const sources: Record<string, SourceConfig> = {};
  for (const [ns, entry] of sourceEntries) {
    const use = entry.use as unknown as TakoParser<unknown>;
    const parsedOptions = parseDriverOptions(
      'parser',
      use.name,
      use.optionsSchema,
      entry.options,
      ns,
    );
    const parser: SourceConfig['parser'] = {
      name: use.name,
      parse: (ctx) => use.parse(ctx, parsedOptions),
    };
    if (use.watchPaths) {
      const watchPaths = use.watchPaths.bind(use);
      parser.watchPaths = (ctx) => watchPaths(ctx, parsedOptions);
    }
    sources[ns] = { parser, options: parsedOptions };
  }

  const generators: Record<string, GeneratorConfig> = {};
  for (const entry of generatorEntries) {
    const use = entry.use as unknown as TakoGenerator<unknown>;
    const parsedOptions = parseDriverOptions(
      'generator',
      use.name,
      use.optionsSchema,
      entry.options,
    );
    generators[use.name] = {
      generator: {
        name: use.name,
        dependsOn: use.dependsOn,
        optionalDependsOn: use.optionalDependsOn,
        generate: (ctx) => use.generate(ctx, parsedOptions),
      },
      options: parsedOptions,
      namespaces: entry.namespaces,
    };
  }

  // --- outputs ---------------------------------------------------------------
  const resolvedOutputs: OutputConfig[] = config.outputs.map((entry) => {
    const resolvedOutput: OutputConfig = { mode: entry.mode ?? 'dir' };
    resolvedOutput.dir = absolutize(entry.dir ?? DEFAULT_OUTPUT_DIR, rootDir);
    if (entry.packagesDir !== undefined) {
      resolvedOutput.packagesDir = absolutize(entry.packagesDir, rootDir);
    }
    if (entry.scope !== undefined) {
      resolvedOutput.scope = entry.scope;
    }
    if (entry.packageManager !== undefined) {
      resolvedOutput.packageManager = entry.packageManager;
    }
    if (entry.generators !== undefined) {
      resolvedOutput.generators = entry.generators;
    }
    return resolvedOutput;
  });

  const resolved: ResolvedConfig = {
    rootDir,
    sources,
    generators,
    outputs: resolvedOutputs,
    hooks: (mod as { hooks?: TakoHooks }).hooks,
  };

  return { config: resolved, configFile, rootDir };
}

function absolutize(p: string, rootDir: string): string {
  return isAbsolute(p) ? p : resolve(rootDir, p);
}

function parseDriverOptions(
  role: 'parser' | 'generator',
  name: string,
  schema: v.GenericSchema<unknown, unknown> | undefined,
  options: unknown,
  namespace?: string,
): unknown {
  if (schema) {
    // Every `optionsSchema` is an object schema (`v.object` / `v.strictObject`).
    // A driver whose every option has a default or is optional must still load
    // when the entry omits `options` entirely, so normalise `undefined` to `{}`
    // before validation; defaults are then applied by the schema.
    const input = options === undefined ? {} : options;
    const result = v.safeParse(schema, input);
    if (!result.success) {
      throw new DriverOptionsError(
        role,
        name,
        normalizeIssues(result.issues),
        namespace,
      );
    }
    return result.output;
  }
  // No schema: `options` must be `undefined` or a plain object (overview:
  // "core only checks the `options` field is an object or missing").
  if (options !== undefined && !isPlainObject(options)) {
    throw new DriverOptionsError(
      role,
      name,
      [
        {
          path: 'options',
          message:
            'driver declares no optionsSchema; options must be omitted or a plain object',
        },
      ],
      namespace,
    );
  }
  return options;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}
