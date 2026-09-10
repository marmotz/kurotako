import { PrismaContractVersionError } from '../errors.js';

export const SUPPORTED_SCHEMA_VERSIONS = new Set(['1']);

export function assertSupportedVersion(found: string): void {
  if (!SUPPORTED_SCHEMA_VERSIONS.has(found)) {
    throw new PrismaContractVersionError(found, [...SUPPORTED_SCHEMA_VERSIONS]);
  }
}
