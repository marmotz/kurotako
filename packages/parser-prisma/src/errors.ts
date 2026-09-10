/**
 * Prisma-parser error classes. Each extends `TakoError` from `@kurotako/core`
 * so the CLI's single `instanceof TakoError` catch covers them; `@kurotako/core`
 * additionally wraps any throw from `parse()` as a `DriverError`.
 *
 * Codes: `prisma_input`, `prisma_peer_missing`, `prisma_schema`,
 * `prisma_contract`, `prisma_contract_version`, `prisma_dialect`, and
 * `prisma_entity_collision`.
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

/** A Prisma 8 contract is invalid JSON or does not have the expected shape. */
export class PrismaContractError extends TakoError {
  constructor(detail: string, options?: { cause?: unknown }) {
    super(
      'prisma_contract',
      `invalid Prisma 8 contract.json: ${detail}`,
      options,
    );
  }
}

/** The contract schema version is not one this parser understands. */
export class PrismaContractVersionError extends TakoError {
  readonly found: string;

  constructor(found: string, expected: readonly string[]) {
    super(
      'prisma_contract_version',
      `unsupported Prisma contract schemaVersion '${found}' (expected one of: ${expected.join(', ')})`,
    );
    this.found = found;
  }
}

/** A contract codec belongs to a database dialect kurotako does not support. */
export class PrismaDialectError extends TakoError {
  readonly codecId: string;

  constructor(codecId: string) {
    const dialect = codecId.split('/')[0] ?? codecId;
    super(
      'prisma_dialect',
      `unsupported Prisma contract dialect '${dialect}' in codec '${codecId}'; only PostgreSQL contracts are supported currently`,
    );
    this.codecId = codecId;
  }
}

/** Multiple namespace-qualified models resolve to the same IR entity name. */
export class PrismaEntityCollisionError extends TakoError {
  readonly entityName: string;
  readonly models: readonly string[];

  constructor(entityName: string, models: readonly string[]) {
    super(
      'prisma_entity_collision',
      `Prisma contract models ${models.join(', ')} resolve to the same entity name '${entityName}'`,
    );
    this.entityName = entityName;
    this.models = models;
  }
}

/** Prisma emitted a relation to a homonym model whose namespace is unreliable. */
export class PrismaAmbiguousRelationError extends TakoError {
  constructor(modelName: string) {
    super(
      'prisma_ambiguous_relation',
      `Prisma contract relation targets '${modelName}', which exists in multiple namespaces; Prisma 8 RC does not resolve this reliably`,
    );
  }
}
