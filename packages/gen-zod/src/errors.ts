/**
 * `@kurotako/gen-zod` error classes.
 *
 * `ZodGenError` is a plain `Error` subclass carrying a stable `code`; the Zod
 * generator has no dependency on `@kurotako/core` at runtime, and `@kurotako/core`
 * wraps any throw from `generate()` as a `DriverError` for the CLI's single
 * `instanceof TakoError` catch.
 *
 * Codes: `zod_enum_collision`.
 */

export class ZodGenError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Two distinct `EnumDef`s reachable in one source share a name (typically an
 * entity-local enum shadowing a differently-defined source-level one). Names both.
 */
export class ZodEnumCollisionError extends ZodGenError {
  readonly enumName: string;

  constructor(enumName: string, firstOrigin: string, secondOrigin: string) {
    super(
      'zod_enum_collision',
      `enum '${enumName}' is defined twice with different values (${firstOrigin} vs ${secondOrigin}); ` +
        'rename one of them in the source schema',
    );
    this.enumName = enumName;
  }
}
