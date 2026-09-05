import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { directoryWriter } from './directory.js';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kurotako-writer-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('directoryWriter', () => {
  it('rejects a missing output.dir with a config error code', async () => {
    await expect(
      directoryWriter.write({ files: [], output: {} }),
    ).rejects.toMatchObject({ code: 'invalid_output_config' });
  });

  it('wipes a pre-existing file that is not re-emitted', async () => {
    const stale = path.join(dir, 'stale.ts');
    await fs.writeFile(stale, 'old', 'utf8');
    await directoryWriter.write({
      files: [{ path: 'kept.ts', content: 'new' }],
      output: { dir },
    });
    await expect(fs.readFile(stale, 'utf8')).rejects.toThrow();
  });

  it('creates nested directories and round-trips content', async () => {
    await directoryWriter.write({
      files: [{ path: 'pg/zod/User.ts', content: 'export const x = 1;\n' }],
      output: { dir },
    });
    expect(await fs.readFile(path.join(dir, 'pg/zod/User.ts'), 'utf8')).toBe(
      'export const x = 1;\n',
    );
  });

  it('plan() returns sorted absolute paths under output.dir + .gitattributes, no disk I/O', async () => {
    const rm = vi.spyOn(fs, 'rm');
    const mkdir = vi.spyOn(fs, 'mkdir');
    const writeFile = vi.spyOn(fs, 'writeFile');

    const planned = await directoryWriter.plan({
      files: [
        { path: 'b.ts', content: 'b' },
        { path: 'a/a.ts', content: 'a' },
      ],
      output: { dir },
    });

    expect(planned.map((p) => p.path)).toEqual([
      path.join(dir, '.gitattributes'),
      path.join(dir, 'a/a.ts'),
      path.join(dir, 'b.ts'),
    ]);
    expect(planned.every((p) => path.isAbsolute(p.path))).toBe(true);
    expect(
      planned.find((p) => p.path.endsWith('.gitattributes'))?.content,
    ).toBe('* linguist-generated=true\n');
    expect(rm).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
    expect(await fs.readdir(dir)).toEqual([]);

    rm.mockRestore();
    mkdir.mockRestore();
    writeFile.mockRestore();
  });

  it('plan() content is byte-identical to what write() puts on disk', async () => {
    const files = [
      { path: 'pg/zod/User.ts', content: 'export const x = 1;\n' },
      { path: 'pg/index.ts', content: "export * from './zod';\n" },
    ];
    const planned = await directoryWriter.plan({ files, output: { dir } });
    await directoryWriter.write({ files, output: { dir } });

    for (const entry of planned) {
      expect(await fs.readFile(entry.path, 'utf8')).toBe(entry.content);
    }
  });

  it('writes .gitattributes and returns sorted absolute paths', async () => {
    const written = await directoryWriter.write({
      files: [
        { path: 'b.ts', content: 'b' },
        { path: 'a/a.ts', content: 'a' },
      ],
      output: { dir },
    });
    expect(await fs.readFile(path.join(dir, '.gitattributes'), 'utf8')).toBe(
      '* linguist-generated=true\n',
    );
    expect(written).toEqual([...written].sort());
    expect(written.every((p) => path.isAbsolute(p))).toBe(true);
    expect(written).toContain(path.join(dir, '.gitattributes'));
  });
});
