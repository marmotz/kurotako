/**
 * Small assertion helpers for the gen-zod tests — keep the test bodies free of
 * non-null assertions under `noUncheckedIndexedAccess`.
 */
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import type { Entity, IR, SourceIR } from '@kurotako/ir';
import { zodGenerator } from '../generator.js';
import type { ZodGeneratorOptions } from '../options.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

export function entityOf(source: SourceIR, name: string): Entity {
  const e = source.entities[name];
  if (e === undefined) {
    throw new Error(`fixture has no entity '${name}'`);
  }
  return e;
}

export function runGenerator(
  ir: IR,
  options: ZodGeneratorOptions,
  logger: GenerateContext['logger'] = noopLogger,
): GenOutput {
  const out = zodGenerator.generate({ ir, dependencies: {}, logger }, options);
  if (out instanceof Promise) {
    throw new Error('zodGenerator.generate must be synchronous');
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
