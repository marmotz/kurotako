/**
 * `TakoError` hierarchy. Every failure in the pipeline is fail-fast and carries
 * enough context to name the offending source or generator. The CLI maps any
 * `TakoError` to a formatted message + non-zero exit; a non-`TakoError` throw is
 * a bug and surfaces as a stack trace.
 *
 * Error table: `backlog/features/core-pipeline/technical.md` §Error model.
 */
import type { IrIssue } from '@kurotako/ir';

export class TakoError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class NamespaceMismatchError extends TakoError {
  readonly namespace: string;
  readonly returned: string;

  constructor(namespace: string, returned: string) {
    super(
      'namespace_mismatch',
      `parser for namespace '${namespace}' returned a SourceIR with namespace '${returned}'`,
    );
    this.namespace = namespace;
    this.returned = returned;
  }
}

export class IrValidationError extends TakoError {
  readonly issues: IrIssue[];
  readonly namespace?: string;

  constructor(issues: IrIssue[], namespace?: string) {
    const detail = issues
      .map((i) => `${i.path === '' ? '<root>' : i.path}: ${i.message}`)
      .join('; ');
    const where = namespace ? ` in namespace '${namespace}'` : '';
    super('ir_invalid', `invalid IR${where}: ${detail}`);
    this.issues = issues;
    this.namespace = namespace;
  }
}

export class DuplicateNamespaceError extends TakoError {
  readonly namespace: string;

  constructor(namespace: string) {
    super(
      'duplicate_namespace',
      `two sources claim the namespace '${namespace}'`,
    );
    this.namespace = namespace;
  }
}

export class OutputCollisionError extends TakoError {
  readonly path: string;
  readonly generators: [string, string];

  constructor(path: string, generators: [string, string], hint?: string) {
    super(
      'output_collision',
      `generators '${generators[0]}' and '${generators[1]}' both emit '${path}'${
        hint ? `. ${hint}` : ''
      }`,
    );
    this.path = path;
    this.generators = generators;
  }
}

export class InvalidOutputPathError extends TakoError {
  readonly path: string;
  readonly generator: string;

  constructor(path: string, generator: string) {
    super(
      'invalid_output_path',
      `generator '${generator}' emits '${path}', which escapes the output root`,
    );
    this.path = path;
    this.generator = generator;
  }
}

export class UnsupportedOutputModeError extends TakoError {
  readonly mode: string;

  constructor(mode: string) {
    super(
      'unsupported_output_mode',
      `unsupported output mode '${mode}' (expected 'dir' or 'package')`,
    );
    this.mode = mode;
  }
}

export class OutputPeerConflictError extends TakoError {
  readonly namespace?: string;
  readonly package: string;
  readonly ranges: string[];
  readonly generators: string[];
  readonly dependent?: string;

  /**
   * Raised while aggregating mode B peers (`namespace` set, `generators` are the
   * two contributors) or while merging a private dependency's peers into its
   * dependent's artifact (`namespace` absent, `dependent` names the dependent and
   * `generators` the two conflicting owners).
   */
  constructor(
    namespace: string | undefined,
    pkg: string,
    ranges: string[],
    generators: string[],
    dependent?: string,
  ) {
    const where = namespace === undefined ? '' : `namespace '${namespace}': `;
    const via =
      dependent === undefined
        ? ''
        : ` (merged into the peers of generator '${dependent}')`;
    super(
      'output_peer_conflict',
      `${where}generators [${generators.join(', ')}] declare peer '${pkg}' with conflicting ranges [${ranges.join(', ')}]${via}`,
    );
    this.namespace = namespace;
    this.package = pkg;
    this.ranges = ranges;
    this.generators = generators;
    this.dependent = dependent;
  }
}

/**
 * A private generator instance emitted a file outside the sub-tree it was given
 * (`<namespace>/<segment>/`), which would land next to (or over) its dependent's
 * own output.
 */
export class SegmentViolationError extends TakoError {
  readonly generator: string;
  readonly path: string;
  readonly expected: string;

  constructor(generator: string, path: string, expected: string) {
    super(
      'segment_violation',
      `generator '${generator}' runs as a private dependency and emitted '${path}', outside its sub-tree '${expected}'; build paths from ctx.segment`,
    );
    this.generator = generator;
    this.path = path;
    this.expected = expected;
  }
}

export class PackageBuildError extends TakoError {
  readonly namespace: string;

  constructor(namespace: string, options?: { cause?: unknown }) {
    super(
      'package_build_error',
      `the build of the generated package for namespace '${namespace}' failed`,
      options,
    );
    this.namespace = namespace;
  }
}

const MISSING_PACKAGE_WORKSPACE_FILE_GUIDANCE: Record<string, string> = {
  'tsconfig.base.json': `Create '<workspaceRoot>/tsconfig.base.json':
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true
  }
}

Use these values as-is, no adjustment needed: in particular, keep
"moduleResolution": "bundler" as the simplest option compatible with every
generated import style.`,
  'tsup.config.base.{ts,js,mjs,cjs}': `Create '<workspaceRoot>/tsup.config.base.ts':
import type { Options } from 'tsup';

export const basePreset: Options = {
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: { compilerOptions: { composite: false, incremental: false } },
  sourcemap: true,
  clean: true,
  target: 'node22',
  outDir: 'dist',
};`,
  "'typescript' (devDependency, needed for the .d.ts build)": `Run, from '<workspaceRoot>':
  <your package manager> add -D typescript`,
};

export class MissingPackageWorkspaceFilesError extends TakoError {
  readonly workspaceRoot: string;
  readonly missing: string[];

  constructor(workspaceRoot: string, missing: string[]) {
    const guidance = missing
      .map((item) => {
        const template = MISSING_PACKAGE_WORKSPACE_FILE_GUIDANCE[item];
        return template
          ? template.replaceAll('<workspaceRoot>', workspaceRoot)
          : item;
      })
      .join('\n\n');
    super(
      'missing_package_workspace_files',
      `mode 'package' requires 'tsconfig.base.json' and 'tsup.config.base.{ts,js,mjs,cjs}' in '${workspaceRoot}' (one directory above 'packagesDir'); missing: ${missing.join(', ')}\n\n${guidance}`,
    );
    this.workspaceRoot = workspaceRoot;
    this.missing = missing;
  }
}

export class OutputNotGeneratedError extends TakoError {
  readonly path: string;

  constructor(path: string) {
    super(
      'output_not_generated',
      `refusing to overwrite '${path}': the directory is not empty and was not created by tako ` +
        `(its 'package.json' has no '"//": "Generated by tako. Do not edit."' marker).\n` +
        `To let tako manage this path, either delete the directory or, if its current contents are ` +
        `disposable, add that '//' key to its 'package.json'. Otherwise point this output at an empty ` +
        `or tako-owned directory.`,
    );
    this.path = path;
  }
}

export class PackageInstallError extends TakoError {
  readonly pm: string;

  constructor(pm: string, options?: { cause?: unknown }) {
    super(
      'package_install_error',
      `the '${pm} install' step for the generated packages exited non-zero`,
      options,
    );
    this.pm = pm;
  }
}

export class DriverError extends TakoError {
  readonly role: 'parser' | 'generator';
  readonly driverName: string;
  readonly namespace?: string;
  /** Name of the generator that owns this private instance, when it is one. */
  readonly dependencyOf?: string;

  constructor(
    role: 'parser' | 'generator',
    driverName: string,
    options?: { cause?: unknown; namespace?: string; dependencyOf?: string },
  ) {
    const where = options?.namespace
      ? ` (namespace '${options.namespace}')`
      : '';
    const via = options?.dependencyOf
      ? ` (dependency of '${options.dependencyOf}')`
      : '';
    super(
      'driver_error',
      `${role} '${driverName}'${where}${via} threw during ${role === 'parser' ? 'parse' : 'generate'}`,
      options,
    );
    this.role = role;
    this.driverName = driverName;
    this.namespace = options?.namespace;
    this.dependencyOf = options?.dependencyOf;
  }
}

export class HookError extends TakoError {
  readonly hook: string;

  constructor(hook: string, options?: { cause?: unknown }) {
    super('hook_error', `the '${hook}' hook threw`, options);
    this.hook = hook;
  }
}
