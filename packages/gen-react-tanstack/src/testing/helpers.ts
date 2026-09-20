/**
 * Small test helpers: a fake `gen-zod` `GeneratorArtifact` matching the naming
 * `@kurotako/gen-zod` actually emits (`${Entity}${Variant}${Family}Schema` /
 * `${Entity}${Variant}${Family}Dto`), plus `runGenerator` / `fileEndingWith`.
 */
import type {
  EntitySymbols,
  GeneratorArtifact,
  GenOutput,
  Logger,
  VirtualFile,
} from '@kurotako/core';
import type { ZodArtifactExtra } from '@kurotako/gen-zod';
import type { IR } from '@kurotako/ir';
import { iterEntities, iterTypeAliases, refCycleMembers } from '@kurotako/ir';
import { reactTanstackGenerator } from '../generator.js';
import type { ReactTanstackGeneratorOptions } from '../options.js';

export const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

function zodEntitySymbols(entity: string): Record<string, string> {
  return {
    schema: `${entity}Schema`,
    type: `${entity}Dto`,
    createSchema: `${entity}CreateSchema`,
    createType: `${entity}CreateDto`,
    updateSchema: `${entity}UpdateSchema`,
    updateType: `${entity}UpdateDto`,
    deepSchema: `${entity}DeepSchema`,
    deepType: `${entity}DeepDto`,
    createDeepSchema: `${entity}CreateDeepSchema`,
    createDeepType: `${entity}CreateDeepDto`,
    updateDeepSchema: `${entity}UpdateDeepSchema`,
    updateDeepType: `${entity}UpdateDeepDto`,
  };
}

/**
 * A fake `gen-zod` artifact for `ir`, matching its real naming convention and the
 * segment `gen-react-tanstack` runs it under: a private dependency, so
 * `react-tanstack/zod`.
 */
export function fakeZodArtifact(
  ir: IR,
  opts?: { zodVersion?: 3 | 4 },
): GeneratorArtifact {
  const zod = 'react-tanstack/zod';
  const entities: Record<string, EntitySymbols> = {};
  const perNamespace: ZodArtifactExtra['perNamespace'] = {};

  for (const { namespace, entity } of iterEntities(ir)) {
    entities[`${namespace}.${entity.name}`] = {
      module: `${namespace}/${zod}/${entity.name}.schema`,
      symbols: zodEntitySymbols(entity.name),
    };
  }
  for (const { namespace, alias } of iterTypeAliases(ir)) {
    entities[`${namespace}.${alias.name}`] = {
      module: `${namespace}/${zod}/aliases`,
      symbols: { schema: `${alias.name}Schema`, type: alias.name },
    };
  }
  for (const [namespace, source] of Object.entries(ir.sources)) {
    const enums: ZodArtifactExtra['perNamespace'][string]['enums'] = {};
    for (const def of Object.values(source.enums)) {
      enums[def.name] = {
        constName: def.name,
        schemaName: `${def.name}Schema`,
        typeName: def.name,
        module: `${namespace}/${zod}/enums`,
      };
    }
    perNamespace[namespace] = {
      enumsModule: `${namespace}/${zod}/enums`,
      filtersModule: `${namespace}/${zod}/filters`,
      barrelModule: `${namespace}/${zod}`,
      enums,
    };
  }

  const extra: ZodArtifactExtra = {
    zodVersion: opts?.zodVersion ?? 4,
    families: ['flat', 'deep'],
    variants: ['full', 'create', 'update', 'where', 'select'],
    perNamespace,
  };

  return {
    entities,
    peerDependencies: { zod: extra.zodVersion === 4 ? '^4' : '^3' },
    extra,
  };
}

export const defaultOptions: ReactTanstackGeneratorOptions = {
  zodVersion: 4,
  variants: ['full'],
  relations: 'flat',
};

export function runGenerator(
  ir: IR,
  zod: GeneratorArtifact,
  options: Partial<ReactTanstackGeneratorOptions> = {},
  logger: Logger = noopLogger,
): GenOutput {
  const cycles = new Set<string>();
  for (const [ns, source] of Object.entries(ir.sources)) {
    for (const member of refCycleMembers(source)) {
      cycles.add(`${ns}.${member}`);
    }
  }
  const out = reactTanstackGenerator.generate(
    { ir, dependencies: { zod }, cycles, segment: 'react-tanstack', logger },
    { ...defaultOptions, ...options },
  );
  if (out instanceof Promise) {
    throw new Error('reactTanstackGenerator.generate must be synchronous');
  }
  return out;
}

export function fileEndingWith(files: VirtualFile[], suffix: string): string {
  const f = files.find((file) => file.path.endsWith(suffix));
  if (f === undefined) {
    throw new Error(`no emitted file ends with '${suffix}'`);
  }
  return f.content;
}
