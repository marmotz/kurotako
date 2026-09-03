/**
 * The v3-vs-v4 Zod API differences behind one interface.
 *
 * The variant / relation / constraint logic is identical between the two Zod
 * majors; only a handful of leaf builders differ (`z.int()` vs
 * `z.number().int()`, top-level string-format builders vs chained methods). Every
 * emitter takes a `ZodDialect` and never branches on the version itself.
 */
import type { StringFormat } from '@kurotako/ir';

export interface ZodDialect {
  readonly version: 3 | 4;
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

const v4: ZodDialect = {
  version: 4,
  scalarInt: () => 'z.int()',
  scalarUuid: () => 'z.uuid()',
  stringFormat: (format) => V4_FORMAT_BUILDER[format],
};

const v3: ZodDialect = {
  version: 3,
  scalarInt: () => 'z.number().int()',
  scalarUuid: () => 'z.string().uuid()',
  stringFormat: (format, base) => `${base}${V3_FORMAT_METHOD[format]}`,
};

export function dialectFor(version: 3 | 4): ZodDialect {
  return version === 4 ? v4 : v3;
}
