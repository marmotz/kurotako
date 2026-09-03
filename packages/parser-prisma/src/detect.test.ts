import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveInput } from './detect.js';
import { PrismaInputError } from './errors.js';

const PKG_DIR = join(import.meta.dirname, '..');

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-detect-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('resolveInput', () => {
  it('resolves a single schema.prisma file to mode 7 / file', async () => {
    writeFileSync(join(root, 'schema.prisma'), 'model A {\n id Int @id\n}\n');
    const input = await resolveInput(root, { schema: 'schema.prisma' }, 'pg');
    expect(input).toEqual({
      mode: 7,
      kind: 'file',
      files: [['schema.prisma', 'model A {\n id Int @id\n}\n']],
    });
  });

  it('collects a prismaSchemaFolder into sorted tuples', async () => {
    mkdirSync(join(root, 'prisma'));
    writeFileSync(
      join(root, 'prisma', 'user.prisma'),
      'model User {\n id Int @id\n}\n',
    );
    writeFileSync(
      join(root, 'prisma', 'schema.prisma'),
      'datasource db {\n provider = "postgresql"\n url = "x"\n}\n',
    );
    const input = await resolveInput(root, { schema: 'prisma' }, 'pg');
    expect(input.mode).toBe(7);
    expect(input.kind).toBe('folder');
    expect(input.mode === 7 && input.files.map(([p]) => p)).toEqual([
      'schema.prisma',
      'user.prisma',
    ]);
  });

  it('picks up a nested prismaSchemaFolder layout one level down', async () => {
    mkdirSync(join(root, 'prisma', 'models'), { recursive: true });
    writeFileSync(join(root, 'prisma', 'schema.prisma'), '// root\n');
    writeFileSync(join(root, 'prisma', 'models', 'post.prisma'), '// post\n');
    const input = await resolveInput(root, { schema: 'prisma' }, 'pg');
    expect(input.mode === 7 && input.files.map(([p]) => p)).toEqual([
      'models/post.prisma',
      'schema.prisma',
    ]);
  });

  it('detects a contract.json file as mode 8', async () => {
    writeFileSync(join(root, 'contract.json'), '{}');
    const input = await resolveInput(root, { schema: 'contract.json' }, 'pg');
    expect(input).toEqual({
      mode: 8,
      kind: 'contract',
      contractPath: join(root, 'contract.json'),
    });
  });

  it('detects a folder holding a contract.json as mode 8', async () => {
    mkdirSync(join(root, 'out'));
    writeFileSync(join(root, 'out', 'contract.json'), '{}');
    const input = await resolveInput(root, { schema: 'out' }, 'pg');
    expect(input.mode).toBe(8);
  });

  it('lets options.version force mode 8 on a .prisma file', async () => {
    writeFileSync(join(root, 'schema.prisma'), 'model A {\n id Int @id\n}\n');
    const input = await resolveInput(
      root,
      { schema: 'schema.prisma', version: 8 },
      'pg',
    );
    expect(input).toEqual({
      mode: 8,
      kind: 'contract',
      contractPath: join(root, 'schema.prisma'),
    });
  });

  it('throws PrismaInputError for a missing path', async () => {
    await expect(
      resolveInput(root, { schema: 'nope.prisma' }, 'pg'),
    ).rejects.toBeInstanceOf(PrismaInputError);
  });

  it('throws PrismaInputError for a folder with no .prisma file', async () => {
    mkdirSync(join(root, 'empty'));
    await expect(
      resolveInput(root, { schema: 'empty' }, 'pg'),
    ).rejects.toBeInstanceOf(PrismaInputError);
  });
});
