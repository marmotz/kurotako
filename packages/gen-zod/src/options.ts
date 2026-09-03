/**
 * Valibot schema for `@kurotako/gen-zod`'s `options`, plus the inferred type.
 * `@kurotako/config` validates a config entry's `options` against this schema and
 * curries it away before `@kurotako/core` sees the generator.
 *
 * One emit targets one Zod API flavor (decided): explicit `zodVersion`, no
 * environment probing — the generator must stay pure for the drift-guard.
 */
import * as v from 'valibot';

export const ZodGeneratorOptions = v.object({
  zodVersion: v.optional(v.picklist([3, 4]), 4),
});

export type ZodGeneratorOptions = v.InferOutput<typeof ZodGeneratorOptions>;
