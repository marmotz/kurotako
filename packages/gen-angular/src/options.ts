/**
 * Valibot schema for `@kurotako/gen-angular`'s `options`, plus the inferred type.
 * `@kurotako/config` validates a config entry's `options` against this schema and
 * curries it away before `@kurotako/core` sees the generator.
 */
import * as v from 'valibot';

export const AngularGeneratorOptions = v.object({
  /** Which form surfaces to emit. Default: both. */
  forms: v.optional(v.array(v.picklist(['reactive', 'signal'])), [
    'reactive',
    'signal',
  ]),
  /** Relation handling: flat (FK scalars only) or deep (nested FormGroup / FormArray). */
  relations: v.optional(v.picklist(['flat', 'deep']), 'flat'),
  /**
   * Zod API flavor of the private Zod copy emitted under `<ns>/angular/zod/`
   * (forwarded to `@kurotako/gen-zod`'s `zodVersion`). Default: 4.
   */
  zodVersion: v.optional(v.picklist([3, 4]), 4),
});

export type AngularGeneratorOptions = v.InferOutput<
  typeof AngularGeneratorOptions
>;
