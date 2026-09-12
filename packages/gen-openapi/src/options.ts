/**
 * Valibot schema for `@kurotako/gen-openapi`'s `options`, plus the inferred type.
 * `@kurotako/config` validates a config entry's `options` against this schema and
 * curries it away before `@kurotako/core` sees the generator.
 *
 * `title` has no static default here: it depends on the namespace, which this
 * schema cannot see — `generator.ts` applies `options.title ?? namespace`.
 */
import * as v from 'valibot';

export const OpenApiGeneratorOptions = v.object({
  openapiVersion: v.optional(v.picklist(['3.0', '3.1']), '3.1'),
  format: v.optional(v.picklist(['json', 'yaml']), 'json'),
  title: v.optional(v.string()),
  version: v.optional(v.string(), '0.0.0'),
});

export type OpenApiGeneratorOptions = v.InferOutput<
  typeof OpenApiGeneratorOptions
>;
