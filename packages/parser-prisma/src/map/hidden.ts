/**
 * "Hidden" fields: the ones that must never reach a read shape (a password hash,
 * a token). Two sources are merged:
 *
 * - the `/// @kurotako.hidden` annotation in a field's doc comment (Prisma 7
 *   mode, where the DMMF carries doc comments; the Prisma 8 `contract.json` does
 *   not), whose line is removed from the field's `doc`;
 * - the parser's `hidden` option, `{ <entity>: [<field>, …] }`, which works in
 *   both modes.
 */
import { PrismaHiddenFieldError } from '../errors.js';

export const HIDDEN_TAG = '@kurotako.hidden';

/** Split a doc comment into its hidden flag and the doc without the tag line. */
export function extractHidden(doc: string | undefined): {
  hidden: boolean;
  doc: string | undefined;
} {
  if (doc === undefined) {
    return { hidden: false, doc };
  }
  const lines = doc.split('\n');
  const kept = lines.filter((line) => line.trim() !== HIDDEN_TAG);
  if (kept.length === lines.length) {
    return { hidden: false, doc };
  }
  const rest = kept.join('\n').trim();
  return { hidden: true, doc: rest === '' ? undefined : rest };
}

/**
 * Fail on an `options.hidden` entry that names no entity or field: a typo would
 * otherwise leave the field exposed without any sign of it.
 */
export function assertHiddenOptionResolves(
  hidden: Record<string, string[]> | undefined,
  entities: ReadonlyArray<{
    name: string;
    fields: ReadonlyArray<{ name: string }>;
  }>,
): void {
  if (hidden === undefined) {
    return;
  }
  const byName = new Map(
    entities.map((entity) => [
      entity.name,
      new Set(entity.fields.map((field) => field.name)),
    ]),
  );
  const unknown: string[] = [];
  for (const [entityName, fieldNames] of Object.entries(hidden)) {
    const known = byName.get(entityName);
    for (const fieldName of fieldNames) {
      if (known === undefined || !known.has(fieldName)) {
        unknown.push(`${entityName}.${fieldName}`);
      }
    }
  }
  if (unknown.length > 0) {
    throw new PrismaHiddenFieldError(unknown);
  }
}
