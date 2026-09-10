import type { Logger } from '@kurotako/core';
import type { FieldType, ScalarType, StringFormat } from '@kurotako/ir';
import { PrismaDialectError } from '../errors.js';

export interface MappedCodec {
  type: FieldType;
  scalarOverride?: ScalarType;
  format?: StringFormat;
  needsLength?: boolean;
}

interface CodecEntry {
  scalar: ScalarType;
  format?: StringFormat;
  needsLength?: boolean;
}

const CODECS: Record<string, CodecEntry> = {
  'pg/text': { scalar: 'string' },
  'pg/text-array': { scalar: 'string' },
  'pg/varchar': { scalar: 'string', needsLength: true },
  'sql/varchar': { scalar: 'string', needsLength: true },
  'pg/char': { scalar: 'string' },
  'pg/bpchar': { scalar: 'string' },
  'pg/bool': { scalar: 'boolean' },
  'pg/int': { scalar: 'int' },
  'pg/int2': { scalar: 'int' },
  'pg/int4': { scalar: 'int' },
  'pg/int8': { scalar: 'bigint' },
  'pg/int8number': { scalar: 'int' },
  'pg/unboundedint': { scalar: 'bigint' },
  'pg/float': { scalar: 'float' },
  'pg/float4': { scalar: 'float' },
  'pg/float8': { scalar: 'float' },
  'pg/numeric': { scalar: 'decimal' },
  'pg/uuid': { scalar: 'uuid' },
  'pg/timestamp-string': { scalar: 'datetime' },
  'pg/timestamp-temporal': { scalar: 'datetime' },
  'pg/timestamptz-string': { scalar: 'datetime' },
  'pg/timestamptz-temporal': { scalar: 'datetime' },
  'pg/date-string': { scalar: 'date' },
  'pg/date-temporal': { scalar: 'date' },
  'pg/time-string': { scalar: 'datetime', format: 'time' },
  'pg/time-temporal': { scalar: 'datetime', format: 'time' },
  'pg/timetz': { scalar: 'datetime', format: 'time' },
  'pg/json': { scalar: 'json' },
  'pg/jsonb': { scalar: 'json' },
  'pg/bytea': { scalar: 'bytes' },
};

function splitCodec(codecId: string): { name: string; version?: string } {
  const at = codecId.lastIndexOf('@');
  return at === -1
    ? { name: codecId }
    : { name: codecId.slice(0, at), version: codecId.slice(at + 1) };
}

export function mapCodec(codecId: string, logger?: Logger): MappedCodec {
  const { name, version } = splitCodec(codecId);
  if (version !== undefined) {
    logger?.debug(`prisma parser: contract codec '${name}' version ${version}`);
  }
  const entry = CODECS[name];
  if (entry) {
    return {
      type: { kind: 'scalar', scalar: entry.scalar },
      ...(entry.format !== undefined ? { format: entry.format } : {}),
      ...(entry.needsLength ? { needsLength: true } : {}),
    };
  }
  // `sql/varchar` is a target-family codec emitted by the PostgreSQL contract.
  if (!name.startsWith('pg/') && !name.startsWith('sql/')) {
    throw new PrismaDialectError(codecId);
  }
  logger?.debug(`prisma parser: unknown contract codec '${codecId}'`);
  return { type: { kind: 'unknown', hint: codecId } };
}
