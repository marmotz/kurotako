/**
 * Mode A writer: `tako` is the exclusive owner of `output.dir` and wipes it
 * unconditionally before generation — no run marker, no path guard (accepted
 * risk, see `core-pipeline/technical.md` §Accepted risks). Disk access is
 * `node:fs/promises` only.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { TakoError } from '../errors.js';
import type { Writer } from './types.js';

const GITATTRIBUTES = '* linguist-generated=true\n';

export const directoryWriter: Writer = {
  async write({ files, output }) {
    if (!output.dir) {
      throw new TakoError(
        'invalid_output_config',
        "mode 'dir' requires 'output.dir'",
      );
    }
    const dir = path.resolve(output.dir);

    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });

    const sorted = [...files].sort((a, b) =>
      a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    );

    const written: string[] = [];
    for (const file of sorted) {
      const absolute = path.join(dir, file.path);
      await fs.mkdir(path.dirname(absolute), { recursive: true });
      await fs.writeFile(absolute, file.content, 'utf8');
      written.push(absolute);
    }

    const gitattributes = path.join(dir, '.gitattributes');
    await fs.writeFile(gitattributes, GITATTRIBUTES, 'utf8');
    written.push(gitattributes);

    return written.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  },
};
