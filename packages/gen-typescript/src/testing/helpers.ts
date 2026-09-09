/** Test-only helpers for running the synchronous generator. */
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import {
  type Entity,
  type Field,
  type IR,
  type Relation,
  refCycleMembers,
  type SourceIR,
} from '@kurotako/ir';
import { typescriptGenerator } from '../generator.js';

export const noopLogger: GenerateContext['logger'] = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function entityOf(source: SourceIR, name: string): Entity {
  const entity = source.entities[name];
  if (entity === undefined) throw new Error(`fixture has no entity '${name}'`);
  return entity;
}

/** Safely select a fixture field under noUncheckedIndexedAccess. */
export function fieldOf(entity: Entity, index: number): Field {
  const field = entity.fields[index];
  if (field === undefined) throw new Error(`fixture has no field at ${index}`);
  return field;
}

/** Safely select a fixture relation under noUncheckedIndexedAccess. */
export function relationOf(entity: Entity, index: number): Relation {
  const relation = entity.relations[index];
  if (relation === undefined) {
    throw new Error(`fixture has no relation at ${index}`);
  }
  return relation;
}

export function runGenerator(
  ir: IR,
  logger: GenerateContext['logger'] = noopLogger,
): GenOutput {
  const cycles = new Set<string>();
  for (const [namespace, source] of Object.entries(ir.sources)) {
    for (const member of refCycleMembers(source)) {
      cycles.add(`${namespace}.${member}`);
    }
  }
  const output = typescriptGenerator.generate({
    ir,
    dependencies: {},
    cycles,
    logger,
  });
  if (output instanceof Promise) {
    throw new Error('typescriptGenerator.generate must be synchronous');
  }
  return output;
}

export function fileEndingWith(files: VirtualFile[], suffix: string): string {
  const file = files.find((candidate) => candidate.path.endsWith(suffix));
  if (file === undefined)
    throw new Error(`no emitted file ends with '${suffix}'`);
  return file.content;
}
