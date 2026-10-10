/**
 * The v3-vs-v4 Zod API differences behind one interface.
 *
 * The variant / relation / constraint logic is identical between the two Zod
 * majors; only a handful of leaf builders differ (`z.int()` vs
 * `z.number().int()`, top-level string-format builders vs chained methods). Every
 * emitter takes a `ZodDialect` and never branches on the version itself.
 */
import type { DateType, StringFormat } from '@kurotako/ir';
import { temporalClass } from '@kurotako/ir';

export interface ZodDialect {
  readonly version: 3 | 4;
  /** How `date` / `datetime` fields are modelled (the generator's `dateType` option). */
  readonly dateType: DateType;
  /**
   * Base expression for a `date` / `datetime` scalar. `format` is the field's
   * `constraints.format`: `'time'` marks a time of day rather than a timestamp.
   */
  scalarDate(scalar: 'date' | 'datetime', format?: StringFormat): string;
  /** Base expression for an `int` scalar. */
  scalarInt(): string;
  /** Base expression for a `uuid` scalar. */
  scalarUuid(): string;
  /**
   * Apply a string `format` constraint. v4 replaces the base with a top-level
   * builder (`z.email()`); v3 chains a method onto it (`.email()`).
   */
  stringFormat(format: StringFormat, base: string): string;
}

const V4_FORMAT_BUILDER: Record<StringFormat, string> = {
  email: 'z.email()',
  url: 'z.url()',
  uuid: 'z.uuid()',
  cuid: 'z.cuid()',
  cuid2: 'z.cuid2()',
  ulid: 'z.ulid()',
  datetime: 'z.iso.datetime()',
  date: 'z.iso.date()',
  time: 'z.iso.time()',
  duration: 'z.iso.duration()',
  ipv4: 'z.ipv4()',
  ipv6: 'z.ipv6()',
};

const V3_FORMAT_METHOD: Record<StringFormat, string> = {
  email: '.email()',
  url: '.url()',
  uuid: '.uuid()',
  cuid: '.cuid()',
  cuid2: '.cuid2()',
  ulid: '.ulid()',
  datetime: '.datetime()',
  date: '.date()',
  time: '.time()',
  duration: '.duration()',
  ipv4: ".ip({ version: 'v4' })",
  ipv6: ".ip({ version: 'v6' })",
};

/** Name of the generated helper schema (in `temporal.ts`) for a Temporal class. */
export const TEMPORAL_SCHEMA_NAMES = {
  Instant: 'TemporalInstantSchema',
  PlainDate: 'TemporalPlainDateSchema',
  PlainTime: 'TemporalPlainTimeSchema',
} as const;

function scalarDateFor(
  dateType: DateType,
  stringFormat: ZodDialect['stringFormat'],
): ZodDialect['scalarDate'] {
  return (scalar, format) => {
    switch (dateType) {
      case 'date':
        return 'z.coerce.date()';
      case 'string': {
        const kind =
          scalar === 'date' ? 'date' : format === 'time' ? 'time' : 'datetime';
        return stringFormat(kind, 'z.string()');
      }
      case 'temporal':
        return TEMPORAL_SCHEMA_NAMES[temporalClass(scalar, format)];
    }
  };
}

function v4(dateType: DateType): ZodDialect {
  const stringFormat: ZodDialect['stringFormat'] = (format) =>
    V4_FORMAT_BUILDER[format];
  return {
    version: 4,
    dateType,
    scalarDate: scalarDateFor(dateType, stringFormat),
    scalarInt: () => 'z.int()',
    scalarUuid: () => 'z.uuid()',
    stringFormat,
  };
}

function v3(dateType: DateType): ZodDialect {
  const stringFormat: ZodDialect['stringFormat'] = (format, base) =>
    `${base}${V3_FORMAT_METHOD[format]}`;
  return {
    version: 3,
    dateType,
    scalarDate: scalarDateFor(dateType, stringFormat),
    scalarInt: () => 'z.number().int()',
    scalarUuid: () => 'z.string().uuid()',
    stringFormat,
  };
}

export function dialectFor(
  version: 3 | 4,
  dateType: DateType = 'date',
): ZodDialect {
  return version === 4 ? v4(dateType) : v3(dateType);
}
