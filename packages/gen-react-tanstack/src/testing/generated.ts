/**
 * Runs `zodGenerator` + `reactTanstackGenerator` the way core does (the Zod copy
 * first, into `<ns>/react-tanstack/zod/`) and writes the result to disk, for the
 * compile and behaviour tests. Not part of the published surface.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { VirtualFile } from '@kurotako/core';
import { zodGenerator } from '@kurotako/gen-zod';
import type { IR } from '@kurotako/ir';
import { refCycleMembers } from '@kurotako/ir';
import { reactTanstackGenerator } from '../generator.js';
import type { ReactTanstackGeneratorOptions } from '../options.js';
import { defaultOptions, noopLogger } from './helpers.js';

export async function generateFiles(
  ir: IR,
  options: Partial<ReactTanstackGeneratorOptions> = {},
): Promise<VirtualFile[]> {
  const cycles = new Set<string>();
  for (const [ns, source] of Object.entries(ir.sources)) {
    for (const member of refCycleMembers(source)) {
      cycles.add(`${ns}.${member}`);
    }
  }
  const merged = { ...defaultOptions, ...options };
  const zodOut = await zodGenerator.generate(
    {
      ir,
      dependencies: {},
      cycles,
      segment: 'react-tanstack/zod',
      logger: noopLogger,
    },
    { zodVersion: merged.zodVersion },
  );
  const out = await reactTanstackGenerator.generate(
    {
      ir,
      dependencies: { zod: zodOut.artifact },
      cycles,
      segment: 'react-tanstack',
      logger: noopLogger,
    },
    merged,
  );
  return [...zodOut.files, ...out.files];
}

export async function writeFiles(
  root: string,
  files: readonly VirtualFile[],
): Promise<void> {
  for (const file of files) {
    const target = path.join(root, file.path);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
}

/**
 * Rewrites the generated `from '<ns>/...'` specifiers (resolved by the consumer's
 * tsconfig `paths` / the output mode) into relative ones, so a test runner can
 * import the files without a path alias.
 */
export function relativizeSpecifiers(
  files: readonly VirtualFile[],
  namespaces: readonly string[],
): VirtualFile[] {
  const nsPattern = namespaces.join('|');
  const re = new RegExp(`from '((?:${nsPattern})/[^']+)'`, 'g');
  return files.map((file) => ({
    path: file.path,
    content: file.content.replace(re, (_match, spec: string) => {
      let rel = path.posix.relative(path.posix.dirname(file.path), spec);
      if (!rel.startsWith('.')) {
        rel = `./${rel}`;
      }
      return `from '${rel}'`;
    }),
  }));
}
