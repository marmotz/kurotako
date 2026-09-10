/**
 * Pipeline integration: an `openapiParser` document flows through the Zod,
 * TypeScript, and Angular generators and every generator emits map-aware output
 * for the IR v3 typed-map surface the parser produces.
 */
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { GenerateContext } from '@kurotako/core';
import { angularGenerator } from '@kurotako/gen-angular';
import { typescriptGenerator } from '@kurotako/gen-typescript';
import { zodGenerator } from '@kurotako/gen-zod';
import type { IR } from '@kurotako/ir';
import { IR_VERSION, refCycleMembers } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { openapiParser } from './parser.js';

const noopLogger = { debug() {}, info() {}, warn() {}, error() {} };

const context = (cwd: string) =>
  ({ cwd, namespace: 'api', logger: noopLogger }) as never;

function fileEndingWith(
  files: { path: string; content: string }[],
  suffix: string,
): string {
  const file = files.find((entry) => entry.path.endsWith(suffix));
  if (file === undefined)
    throw new Error(`no emitted file ends with '${suffix}'`);
  return file.content;
}

describe('openapiParser pipeline integration', () => {
  it('feeds Zod, TypeScript and Angular generators with map-aware output', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'kurotako-openapi-int-'));
    await writeFile(
      join(cwd, 'openapi.json'),
      JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1' },
        paths: {},
        components: {
          schemas: {
            Settings: {
              type: 'object',
              required: ['flags'],
              properties: {
                flags: {
                  type: 'object',
                  additionalProperties: { type: 'boolean' },
                },
              },
              additionalProperties: { type: 'string' },
            },
          },
        },
      }),
    );

    const source = await openapiParser.parse(context(cwd), {
      document: 'openapi.json',
    });
    const ir: IR = { irVersion: IR_VERSION, sources: { api: source } };
    const cycles = new Set<string>();
    for (const member of refCycleMembers(source)) cycles.add(`api.${member}`);
    const baseCtx: Omit<GenerateContext, 'dependencies'> = {
      ir,
      cycles,
      logger: noopLogger,
    };

    const zod = zodGenerator.generate(
      { ...baseCtx, dependencies: {} },
      { zodVersion: 4 },
    );
    if (zod instanceof Promise) throw new Error('zod generate must be sync');
    expect(fileEndingWith(zod.files, 'api/zod/Settings.schema.ts')).toContain(
      'flags: z.record(z.string(), z.boolean())',
    );
    expect(fileEndingWith(zod.files, 'api/zod/Settings.schema.ts')).toContain(
      '.catchall(z.string())',
    );

    const ts = typescriptGenerator.generate({ ...baseCtx, dependencies: {} });
    if (ts instanceof Promise)
      throw new Error('typescript generate must be sync');
    const tsEntity = fileEndingWith(
      ts.files,
      'api/typescript/Settings.type.ts',
    );
    expect(tsEntity).toContain('flags: Record<string, boolean>;');
    expect(tsEntity).toContain('[key: string]: string');

    const angular = angularGenerator.generate(
      { ...baseCtx, dependencies: { zod: zod.artifact } },
      { forms: ['reactive', 'signal'], relations: 'flat' },
    );
    if (angular instanceof Promise)
      throw new Error('angular generate must be sync');
    expect(
      fileEndingWith(angular.files, 'api/angular/Settings.form.ts'),
    ).toContain('Record<string, boolean>');
  });
});
