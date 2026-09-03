/**
 * Valibot schema for `@kurotako/parser-prisma`'s `options`, plus the inferred
 * type. `@kurotako/config` validates a config entry's `options` against this
 * schema and curries it away before `@kurotako/core` sees the parser.
 *
 * `schema` is resolved against `ParseContext.cwd`. `version` forces the
 * version-mode (see `detect.ts`); omitted, the mode is inferred from the input.
 */
import * as v from 'valibot';

// `strictObject`: an unknown key (a typo like `schemaPath`) is a hard error
// rather than being silently dropped.
export const PrismaParserOptions = v.strictObject({
  schema: v.optional(v.string(), './prisma/schema.prisma'),
  version: v.optional(v.picklist([7, 8])),
});

export type PrismaParserOptions = v.InferOutput<typeof PrismaParserOptions>;
