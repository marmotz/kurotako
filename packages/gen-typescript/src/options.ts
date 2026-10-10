/**
 * Valibot schema for `@kurotako/gen-typescript`'s `options`, plus the inferred
 * type. `@kurotako/config` validates a config entry's `options` against this
 * schema and curries it away before `@kurotako/core` sees the generator.
 *
 * `dateType` is how `date`, `datetime` and time-of-day fields are typed:
 * `'date'` (default, when omitted) a JS `Date`, `'string'` an ISO 8601 string,
 * `'temporal'` a `Temporal.Instant` / `PlainDate` / `PlainTime` (the global
 * `Temporal` types must be available to the consumer's compiler).
 */
import { DateTypeSchema } from '@kurotako/ir';
import * as v from 'valibot';

export const TypeScriptGeneratorOptions = v.object({
  dateType: v.optional(DateTypeSchema),
});

export type TypeScriptGeneratorOptions = v.InferOutput<
  typeof TypeScriptGeneratorOptions
>;
