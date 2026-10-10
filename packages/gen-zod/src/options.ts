/**
 * Valibot schema for `@kurotako/gen-zod`'s `options`, plus the inferred type.
 * `@kurotako/config` validates a config entry's `options` against this schema and
 * curries it away before `@kurotako/core` sees the generator.
 *
 * One emit targets one Zod API flavor (decided): explicit `zodVersion`, no
 * environment probing — the generator must stay pure for the drift-guard.
 */
import { DateTypeSchema } from '@kurotako/ir';
import * as v from 'valibot';

/**
 * `dateType` is how `date`, `datetime` and time-of-day fields are modelled:
 * - `'date'` (default, when omitted): `z.coerce.date()`, a JS `Date`.
 * - `'string'`: an ISO 8601 string (`z.iso.datetime()`, `z.iso.date()`, `z.iso.time()`).
 * - `'temporal'`: a `Temporal.Instant` / `PlainDate` / `PlainTime`, accepting an
 *   ISO 8601 string (an HTTP body) or an existing Temporal object (an ORM row);
 *   needs a global `Temporal` at parse time.
 */
export const ZodGeneratorOptions = v.object({
  zodVersion: v.optional(v.picklist([3, 4]), 4),
  dateType: v.optional(DateTypeSchema),
});

export type ZodGeneratorOptions = v.InferOutput<typeof ZodGeneratorOptions>;
