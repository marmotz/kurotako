/**
 * `@kurotako/gen-openapi` — the OpenAPI generator driver.
 *
 * Maps the IR to one OpenAPI document (`components/schemas` only, no
 * `paths`/operations) per namespace. Single entry point: the driver object,
 * its options schema/type and the error classes.
 */
export {
  OpenApiGenError,
  OpenApiGenInvalidSchemaNameError,
} from './errors.js';
export { openapiGenerator } from './generator.js';
export { OpenApiGeneratorOptions } from './options.js';
