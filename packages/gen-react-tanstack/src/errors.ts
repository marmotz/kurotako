/**
 * `@kurotako/gen-react-tanstack` error classes.
 *
 * `ReactTanstackGenError` is a plain `Error` subclass carrying a stable `code`; the
 * generator has no runtime dependency on `@kurotako/core`, which wraps any throw from
 * `generate()` as a `DriverError` for the CLI's single `instanceof TakoError` catch.
 *
 * Codes: `react_tanstack_missing_zod_dependency`, `react_tanstack_missing_zod_symbol`,
 * `react_tanstack_unknown_include_entity`.
 */

export class ReactTanstackGenError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/** `ctx.dependencies.zod` is absent at runtime despite the `dependsOn` descriptor. */
export class MissingZodDependencyError extends ReactTanstackGenError {
  constructor() {
    super(
      'react_tanstack_missing_zod_dependency',
      "the private 'zod' dependency artifact is missing at runtime despite dependsOn",
    );
  }
}

/**
 * The Zod artifact has no entry (or no `role` symbol) for `${ns}.${entity}`. The
 * private `zod` dependency always runs, but a role can still be absent if the
 * consumed `gen-zod` version predates it.
 */
export class MissingZodSymbolError extends ReactTanstackGenError {
  readonly entityKey: string;
  readonly role: string;

  constructor(entityKey: string, role: string) {
    super(
      'react_tanstack_missing_zod_symbol',
      `Zod artifact for '${entityKey}' has no '${role}' symbol; regenerate with a gen-zod version that exposes it`,
    );
    this.entityKey = entityKey;
    this.role = role;
  }
}

/** An `include` name that matches no entity in any namespace the generator covers. */
export class UnknownIncludeEntityError extends ReactTanstackGenError {
  readonly entity: string;

  constructor(entity: string) {
    super(
      'react_tanstack_unknown_include_entity',
      `'include' names entity '${entity}', which exists in none of the covered namespaces`,
    );
    this.entity = entity;
  }
}
