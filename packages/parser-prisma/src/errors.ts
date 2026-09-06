/**
 * Prisma-parser error classes. Each extends `TakoError` from `@kurotako/core`
 * so the CLI's single `instanceof TakoError` catch covers them; `@kurotako/core`
 * additionally wraps any throw from `parse()` as a `DriverError`.
 *
 * Codes: `prisma_input`, `prisma_peer_missing`, `prisma_schema`.
 */
import { TakoError } from '@kurotako/core';

/** Schema path missing, an empty folder, or a folder with no `.prisma` file. */
export class PrismaInputError extends TakoError {
  readonly namespace: string;
  readonly resolvedPath: string;

  constructor(namespace: string, resolvedPath: string, detail: string) {
    super(
      'prisma_input',
      `prisma parser (namespace '${namespace}'): ${detail} (resolved path: ${resolvedPath})`,
    );
    this.namespace = namespace;
    this.resolvedPath = resolvedPath;
  }
}

/** `@prisma/internals` cannot be resolved from the project. */
export class PrismaPeerMissingError extends TakoError {
  readonly namespace: string;

  constructor(namespace: string, options?: { cause?: unknown }) {
    super(
      'prisma_peer_missing',
      `prisma parser (namespace '${namespace}'): '@prisma/internals' could not be resolved. ` +
        'Add it as a devDependency (`bun add -d @prisma/internals`, matching your Prisma major). ' +
        'In a monorepo it is resolved from the directory holding the schema, so it may ' +
        'be installed in the sub-project that owns the schema rather than at the repo root. ' +
        'Note: installing it pulls @prisma/engines, whose postinstall downloads a schema-engine binary.',
      options,
    );
    this.namespace = namespace;
  }
}

/** `getDMMF` threw — an invalid schema. Carries the Prisma message and `cause`. */
export class PrismaSchemaError extends TakoError {
  readonly namespace: string;
  readonly prismaMessage: string;

  constructor(
    namespace: string,
    prismaMessage: string,
    options?: { cause?: unknown },
  ) {
    super(
      'prisma_schema',
      `prisma parser (namespace '${namespace}'): the Prisma schema is invalid:\n${prismaMessage}`,
      options,
    );
    this.namespace = namespace;
    this.prismaMessage = prismaMessage;
  }
}
