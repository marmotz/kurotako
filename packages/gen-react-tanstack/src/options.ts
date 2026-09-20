/**
 * Valibot schema for `@kurotako/gen-react-tanstack`'s `options`, plus the inferred
 * type. `@kurotako/config` validates a config entry's `options` against this schema
 * and curries it away before `@kurotako/core` sees the generator.
 */
import * as v from 'valibot';

export const ReactTanstackGeneratorOptions = v.object({
  /**
   * Zod API flavor of the private Zod copy emitted under `<ns>/react-tanstack/zod/`
   * (forwarded to `@kurotako/gen-zod`'s `zodVersion`). Default: 4.
   */
  zodVersion: v.optional(v.picklist([3, 4]), 4),
  /**
   * Entity names to emit hooks for, applied to every namespace the generator
   * covers. Default: every entity.
   */
  include: v.optional(v.array(v.string())),
  /**
   * Which Zod variant a hook is built on: `full` (the request-body shape),
   * `create` or `update`. At least one. Default: `['full']`.
   */
  variants: v.optional(
    v.pipe(
      v.array(v.picklist(['full', 'create', 'update'])),
      v.minLength(1, 'variants must list at least one variant'),
    ),
    ['full'],
  ),
  /**
   * Relation handling: flat (scalar and enum fields only) or deep (nested objects
   * for to-one relations, arrays for to-many).
   */
  relations: v.optional(v.picklist(['flat', 'deep']), 'flat'),
});

export type ReactTanstackGeneratorOptions = v.InferOutput<
  typeof ReactTanstackGeneratorOptions
>;
