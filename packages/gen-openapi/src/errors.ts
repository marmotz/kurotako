/**
 * `@kurotako/gen-openapi` error classes.
 *
 * `OpenApiGenError` is a plain `Error` subclass carrying a stable `code`; the
 * OpenAPI generator has no dependency on `@kurotako/core` at runtime, and
 * `@kurotako/core` wraps any throw from `generate()` as a `DriverError` for the
 * CLI's single `instanceof TakoError` catch.
 *
 * Codes: `openapi_gen_invalid_schema_name`.
 */

export class OpenApiGenError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * An entity or type-alias name is not a valid OpenAPI `components/schemas` key
 * (the spec restricts it to `^[a-zA-Z0-9._-]+$`). `parser-openapi` never
 * produces such a name, but a name coming from `parser-prisma` (arbitrary model
 * name) is unconstrained.
 */
export class OpenApiGenInvalidSchemaNameError extends OpenApiGenError {
  readonly schemaName: string;

  constructor(schemaName: string) {
    super(
      'openapi_gen_invalid_schema_name',
      `'${schemaName}' is not a valid OpenAPI components/schemas key (must match ^[a-zA-Z0-9._-]+$)`,
    );
    this.schemaName = schemaName;
  }
}
