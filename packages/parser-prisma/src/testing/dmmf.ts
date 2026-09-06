/**
 * Test-only helper: parse a Prisma schema string (or file tuples) through the
 * real `@prisma/internals` `getDMMF`, and optionally lower it to a `PrismaModel`.
 *
 * Not part of the package's public surface — it is never reached from
 * `src/index.ts`, so tsup does not bundle it into `dist`.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import type * as DMMF from '@prisma/dmmf';
import type { PrismaModel } from '../dmmf/model.js';
import { toPrismaModel } from '../dmmf/read.js';

type SchemaFileInput = string | Array<[string, string]>;
type GetDmmf = (o: { datamodel: SchemaFileInput }) => Promise<DMMF.Document>;

let cached: GetDmmf | undefined;

async function getDmmfFn(): Promise<GetDmmf> {
  if (cached) {
    return cached;
  }
  // Resolve from this package's own tree, not `process.cwd()` — the root test
  // runner runs with the repo root as cwd, where the peer is not linked.
  const require = createRequire(`${import.meta.dirname}/noop.js`);
  const mod = (await import(
    pathToFileURL(require.resolve('@prisma/internals')).href
  )) as { getDMMF?: GetDmmf; default?: { getDMMF?: GetDmmf } };
  const fn = mod.default?.getDMMF ?? mod.getDMMF;
  if (typeof fn !== 'function') {
    throw new Error('could not load getDMMF from @prisma/internals');
  }
  cached = fn;
  return fn;
}

// Prisma 7 removed `url` from the datasource block (it moves to prisma.config.ts);
// a bare `provider` block is all `getDMMF` needs and works on Prisma 5-7.
const DATASOURCE = `datasource db {
  provider = "postgresql"
}

`;

/** Prepend a throwaway datasource block unless the schema already has one. */
export function withDatasource(schema: string): string {
  return /^\s*datasource\s/m.test(schema) ? schema : DATASOURCE + schema;
}

export async function getDmmfDoc(
  datamodel: SchemaFileInput,
): Promise<DMMF.Document> {
  const fn = await getDmmfFn();
  const input: SchemaFileInput =
    typeof datamodel === 'string' ? withDatasource(datamodel) : datamodel;
  return fn({ datamodel: input });
}

export async function getModel(schema: string): Promise<PrismaModel> {
  return toPrismaModel(await getDmmfDoc(schema));
}
