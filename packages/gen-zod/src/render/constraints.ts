/**
 * `Constraints` -> a chain of refinements on the base expression, applied in a
 * fixed order so the output is deterministic.
 *
 * Order: `format` (string; v4 replaces the base) -> `minLength` / `maxLength` ->
 * `regex` -> `min` / `max` (numeric). `unique` is a persistence constraint and
 * produces nothing.
 */
import type { Constraints } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import type { BaseClass } from './scalars.js';

export function applyConstraints(
  expr: string,
  c: Constraints,
  base: BaseClass,
  dialect: ZodDialect,
): string {
  let out = expr;

  if (base === 'string') {
    if (c.format !== undefined) {
      out = dialect.stringFormat(c.format, out);
    }
    if (c.minLength !== undefined) {
      out += `.min(${c.minLength})`;
    }
    if (c.maxLength !== undefined) {
      out += `.max(${c.maxLength})`;
    }
    if (c.regex !== undefined) {
      out += `.regex(new RegExp(${JSON.stringify(c.regex)}))`;
    }
  }

  if (base === 'number') {
    if (c.min !== undefined) {
      out += `.min(${c.min})`;
    }
    if (c.max !== undefined) {
      out += `.max(${c.max})`;
    }
  }

  // `c.unique` -> no schema effect (DB-level, not a payload validation rule).
  return out;
}
