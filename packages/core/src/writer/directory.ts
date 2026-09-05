/**
 * Mode A writer: `tako` is the exclusive owner of `output.dir` and wipes it
 * unconditionally before generation — no run marker, no path guard (accepted
 * risk, see `core-pipeline/technical.md` §Accepted risks). Disk access is
 * `node:fs/promises` only.
 *
 * `plan()` is the pure layout half (path + bytes, no disk I/O); `write()` is
 * `plan()` followed by the unconditional wipe + `writeFile` over the plan.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { TakoError } from '../errors.js';
import type { PlannedFile, Writer } from './types.js';

const GITATTRIBUTES = '* linguist-generated=true\n';

function sortByPath<T extends { path: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
}

export const directoryWriter: Writer = {
  async plan({ files, output }) {
    if (!output.dir) {
      throw new TakoError(
        'invalid_output_config',
        "mode 'dir' requires 'output.dir'",
      );
    }
    const dir = path.resolve(output.dir);

    const planned: PlannedFile[] = files.map((file) => ({
      path: path.join(dir, file.path),
      content: file.content,
    }));
    planned.push({
      path: path.join(dir, '.gitattributes'),
      content: GITATTRIBUTES,
    });

    return sortByPath(planned);
  },

  async write(input) {
    const planned = await this.plan(input);
    const dir = path.resolve(input.output.dir as string);

    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });

    for (const file of planned) {
      await fs.mkdir(path.dirname(file.path), { recursive: true });
      await fs.writeFile(file.path, file.content, 'utf8');
    }

    return planned.map((file) => file.path);
  },
};
