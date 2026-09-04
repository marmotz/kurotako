/**
 * `@kurotako/gen-angular` error classes.
 *
 * `AngularGenError` is a plain `Error` subclass carrying a stable `code`; the
 * Angular generator has no dependency on `@kurotako/core` at runtime, and
 * `@kurotako/core` wraps any throw from `generate()` as a `DriverError` for the
 * CLI's single `instanceof TakoError` catch.
 *
 * Codes: `angular_missing_zod_symbol`, `angular_missing_zod_namespace`.
 */

export class AngularGenError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * The Zod artifact has no entry (or no `role` symbol) for `${ns}.${entity}`.
 * `dependsOn: ['zod']` guarantees the dependency ran, but a role can still be
 * absent if the consumed `gen-zod` version predates it.
 */
export class MissingZodSymbolError extends AngularGenError {
  readonly entityKey: string;
  readonly role: string;

  constructor(entityKey: string, role: string) {
    super(
      'angular_missing_zod_symbol',
      `Zod artifact for '${entityKey}' has no '${role}' symbol; regenerate with a gen-zod version that exposes it`,
    );
    this.entityKey = entityKey;
    this.role = role;
  }
}

/** The Zod artifact's `extra.perNamespace` has no entry for a namespace the IR carries. */
export class MissingZodNamespaceError extends AngularGenError {
  readonly namespace: string;

  constructor(namespace: string) {
    super(
      'angular_missing_zod_namespace',
      `Zod artifact has no 'extra.perNamespace[${JSON.stringify(namespace)}]' entry`,
    );
    this.namespace = namespace;
  }
}
