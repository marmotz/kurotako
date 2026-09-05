import { join } from 'node:path';
import type { ParseContext } from '@kurotako/core';
import { noopLogger } from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import type { ResolvedInput } from '../detect.js';

// Package root — where the `@prisma/internals` peer is linked for tests.
const PKG_DIR = join(import.meta.dirname, '..', '..');

import { PrismaPeerMissingError, PrismaSchemaError } from '../errors.js';
import { withDatasource } from '../testing/dmmf.js';
import { readDmmf } from './load.js';

const ctx = (cwd: string, anchorDir?: string): ParseContext => ({
  namespace: 'pg',
  cwd,
  anchorDir,
  logger: noopLogger,
});

const fileInput = (content: string): Extract<ResolvedInput, { mode: 7 }> => ({
  mode: 7,
  kind: 'file',
  files: [['schema.prisma', content]],
});

describe('readDmmf', () => {
  it('parses a valid schema and reports the resolved Prisma version', async () => {
    const { model, prismaVersion } = await readDmmf(
      fileInput(withDatasource('model User {\n  id Int @id\n}\n')),
      ctx(PKG_DIR),
    );
    expect(model.entities.map((e) => e.name)).toEqual(['User']);
    expect(prismaVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('wraps an invalid schema as PrismaSchemaError', async () => {
    await expect(
      readDmmf(fileInput('model User { this is not prisma }'), ctx(PKG_DIR)),
    ).rejects.toBeInstanceOf(PrismaSchemaError);
  });

  it('throws PrismaPeerMissingError when @prisma/internals cannot be resolved', async () => {
    const err = await readDmmf(
      fileInput('model User {\n  id Int @id\n}\n'),
      ctx('/'),
    ).catch((e) => e);
    expect(err).toBeInstanceOf(PrismaPeerMissingError);
    expect((err as Error).message).toContain(
      'resolved from the directory holding the schema',
    );
  });

  it('resolves @prisma/internals from anchorDir, not cwd, when both are set', async () => {
    // anchorDir has no resolvable peer, cwd does ⇒ anchorDir wins ⇒ throws.
    await expect(
      readDmmf(fileInput('model User {\n  id Int @id\n}\n'), ctx(PKG_DIR, '/')),
    ).rejects.toBeInstanceOf(PrismaPeerMissingError);
  });

  it('succeeds when anchorDir resolves the peer even though cwd does not', async () => {
    const { model } = await readDmmf(
      fileInput(withDatasource('model User {\n  id Int @id\n}\n')),
      ctx('/', PKG_DIR),
    );
    expect(model.entities.map((e) => e.name)).toEqual(['User']);
  });
});
