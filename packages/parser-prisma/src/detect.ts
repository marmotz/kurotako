/**
 * Input resolution and version-mode detection.
 *
 * `resolveInput` turns `options.schema` (a `.prisma` file, a
 * `prismaSchemaFolder`, or — deferred — a `contract.json`) into a
 * `ResolvedInput`: the concrete file tuples for the Prisma <= 7 DMMF path, or
 * the `contract.json` path for the deferred Prisma 8 path.
 *
 * `options.version` forces the mode; otherwise it is inferred from what is on
 * disk. Multi-file Prisma schemas are read transparently.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { PrismaInputError } from './errors.js';
import type { PrismaParserOptions } from './options.js';

export type ResolvedInput =
  | { mode: 7; kind: 'file' | 'folder'; files: Array<[string, string]> }
  | { mode: 8; kind: 'contract'; contractPath: string };

const PRISMA_EXT = '.prisma';
const CONTRACT_FILE = 'contract.json';

function toPosix(p: string): string {
  return sep === '/' ? p : p.split(sep).join('/');
}

async function pathKind(p: string): Promise<'file' | 'dir' | 'missing'> {
  try {
    const s = await stat(p);
    return s.isDirectory() ? 'dir' : 'file';
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing';
    }
    throw err;
  }
}

/** `*.prisma` directly in `dir`, then one level down (prismaSchemaFolder layout). */
async function collectPrismaFiles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(PRISMA_EXT)) {
      found.push(full);
    } else if (entry.isDirectory()) {
      const nested = await readdir(full, { withFileTypes: true });
      for (const child of nested) {
        if (child.isFile() && child.name.endsWith(PRISMA_EXT)) {
          found.push(join(full, child.name));
        }
      }
    }
  }
  return found;
}

async function dirHasContract(dir: string): Promise<boolean> {
  return (await pathKind(join(dir, CONTRACT_FILE))) === 'file';
}

async function readTuples(
  root: string,
  files: string[],
): Promise<Array<[string, string]>> {
  const tuples = await Promise.all(
    files.map(
      async (file): Promise<[string, string]> => [
        toPosix(relative(root, file)),
        await readFile(file, 'utf8'),
      ],
    ),
  );
  return tuples.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

async function resolveMode7(
  namespace: string,
  resolved: string,
  kind: 'file' | 'dir',
): Promise<ResolvedInput> {
  if (kind === 'file') {
    return {
      mode: 7,
      kind: 'file',
      files: await readTuples(dirname(resolved), [resolved]),
    };
  }
  const files = await collectPrismaFiles(resolved);
  if (files.length === 0) {
    throw new PrismaInputError(
      namespace,
      resolved,
      'the schema folder contains no .prisma file',
    );
  }
  return { mode: 7, kind: 'folder', files: await readTuples(resolved, files) };
}

async function resolveMode8(
  namespace: string,
  resolved: string,
  kind: 'file' | 'dir',
): Promise<ResolvedInput> {
  if (kind === 'dir') {
    const contractPath = join(resolved, CONTRACT_FILE);
    if ((await pathKind(contractPath)) !== 'file') {
      throw new PrismaInputError(
        namespace,
        resolved,
        `version 8 mode expects a ${CONTRACT_FILE} in the folder`,
      );
    }
    return { mode: 8, kind: 'contract', contractPath };
  }
  return { mode: 8, kind: 'contract', contractPath: resolved };
}

export async function resolveInput(
  cwd: string,
  o: PrismaParserOptions,
  namespace = '<unknown>',
): Promise<ResolvedInput> {
  const resolved = resolve(cwd, o.schema);
  const kind = await pathKind(resolved);
  if (kind === 'missing') {
    throw new PrismaInputError(
      namespace,
      resolved,
      'the schema path does not exist',
    );
  }

  if (o.version === 8) {
    return resolveMode8(namespace, resolved, kind);
  }
  if (o.version === 7) {
    return resolveMode7(namespace, resolved, kind);
  }

  // Infer.
  if (kind === 'file') {
    if (basename(resolved) === CONTRACT_FILE) {
      return { mode: 8, kind: 'contract', contractPath: resolved };
    }
    if (resolved.endsWith(PRISMA_EXT)) {
      return resolveMode7(namespace, resolved, 'file');
    }
    throw new PrismaInputError(
      namespace,
      resolved,
      `not a .prisma file or a ${CONTRACT_FILE}`,
    );
  }

  if (await dirHasContract(resolved)) {
    return resolveMode8(namespace, resolved, 'dir');
  }
  return resolveMode7(namespace, resolved, 'dir');
}
