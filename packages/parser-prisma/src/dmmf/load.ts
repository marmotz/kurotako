/**
 * Prisma <= 7 DMMF acquisition.
 *
 * `@prisma/internals` is an optional peer: it is resolved dynamically from the
 * consumer's project (`ctx.cwd`), not bundled. A resolution failure is a
 * `PrismaPeerMissingError` with an install hint; a `getDMMF` throw (invalid
 * schema) is a `PrismaSchemaError` keeping the Prisma P1012 text and `cause`.
 *
 * The package is CJS-only and its ESM-interop is unreliable, so the `getDMMF`
 * function is looked up on both the namespace and its `default`.
 */

import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ParseContext } from '@kurotako/core';
import type { ResolvedInput } from '../detect.js';
import { PrismaPeerMissingError, PrismaSchemaError } from '../errors.js';
import type { PrismaModel } from './model.js';
import { toPrismaModel } from './read.js';

type SchemaFileInput = string | Array<[string, string]>;
type GetDmmf = (options: {
  datamodel: SchemaFileInput;
}) => Promise<import('@prisma/dmmf').Document>;

interface InternalsModule {
  getDMMF?: GetDmmf;
  default?: { getDMMF?: GetDmmf };
}

async function resolveInternals(
  ctx: ParseContext,
): Promise<{ getDMMF: GetDmmf; prismaVersion: string }> {
  // Resolve `@prisma/internals` from the source's anchor directory (where its
  // schema lives) so it can be a devDependency of the sub-project holding the
  // schema, not only of the repo root. Node still walks up `node_modules` from
  // there to `ctx.cwd` and beyond. Absent ⇒ anchor on `ctx.cwd`.
  const base = ctx.anchorDir ?? ctx.cwd;
  const require = createRequire(join(base, 'noop.js'));

  let entry: string;
  try {
    entry = require.resolve('@prisma/internals');
  } catch (err) {
    throw new PrismaPeerMissingError(ctx.namespace, { cause: err });
  }

  let mod: InternalsModule;
  try {
    mod = (await import(pathToFileURL(entry).href)) as InternalsModule;
  } catch (err) {
    throw new PrismaPeerMissingError(ctx.namespace, { cause: err });
  }

  const getDMMF = mod.default?.getDMMF ?? mod.getDMMF;
  if (typeof getDMMF !== 'function') {
    throw new PrismaPeerMissingError(ctx.namespace);
  }

  let prismaVersion = 'unknown';
  try {
    const pkg = JSON.parse(
      await readFile(require.resolve('@prisma/internals/package.json'), 'utf8'),
    ) as { version?: string };
    if (typeof pkg.version === 'string') {
      prismaVersion = pkg.version;
    }
  } catch {
    ctx.logger.debug(
      'prisma parser: could not read @prisma/internals version',
      { namespace: ctx.namespace },
    );
  }

  return { getDMMF, prismaVersion };
}

export async function readDmmf(
  input: Extract<ResolvedInput, { mode: 7 }>,
  ctx: ParseContext,
): Promise<{ model: PrismaModel; prismaVersion: string }> {
  const { getDMMF, prismaVersion } = await resolveInternals(ctx);

  const datamodel: SchemaFileInput =
    input.kind === 'file'
      ? (input.files[0]?.[1] ?? '')
      : input.files.map(([path, content]) => [path, content]);

  let doc: Awaited<ReturnType<GetDmmf>>;
  try {
    doc = await getDMMF({ datamodel });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new PrismaSchemaError(ctx.namespace, message, { cause: err });
  }

  return { model: toPrismaModel(doc), prismaVersion };
}
