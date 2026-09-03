/**
 * `@kurotako/parser-prisma` — the Prisma parser driver.
 *
 * Reads a Prisma schema (single file or `prismaSchemaFolder`) through
 * `@prisma/internals`' `getDMMF` and produces a `SourceIR` for `@kurotako/core`.
 * Single entry point: the driver object, its options schema/type, and the error
 * classes.
 */

export {
  PrismaInputError,
  PrismaPeerMissingError,
  PrismaSchemaError,
} from './errors.js';
export { PrismaParserOptions } from './options.js';
export { prismaParser } from './parser.js';
