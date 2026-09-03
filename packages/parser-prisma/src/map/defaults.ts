/**
 * Prisma `@default(...)` → IR `DefaultValue`, plus the `StringFormat` a
 * generator-side id default implies.
 *
 * Literals (and enum values, which the DMMF encodes as bare strings) become
 * `{ kind: 'value' }`. Function calls become `{ kind: 'expr' }`; `uuid()` /
 * `cuid()` / `cuid(2)` / `ulid()` additionally carry a `format` (the scalar is
 * left as `string`). `nanoid()` has no matching closed `StringFormat` → expr
 * only.
 */
import type { DefaultValue, StringFormat } from '@kurotako/ir';
import type { PrismaDefault } from '../dmmf/model.js';

export interface MappedDefault {
  default?: DefaultValue;
  format?: StringFormat;
}

const ID_FORMATS: Record<string, StringFormat> = {
  uuid: 'uuid',
  cuid: 'cuid',
  ulid: 'ulid',
};

function isCall(
  raw: PrismaDefault,
): raw is { name: string; args: Array<string | number> } {
  return typeof raw === 'object' && !Array.isArray(raw) && raw !== null;
}

export function mapDefault(raw: PrismaDefault | undefined): MappedDefault {
  if (raw === undefined) {
    return {};
  }

  if (!isCall(raw)) {
    // literal, literal array, or enum value (bare string)
    return { default: { kind: 'value', value: raw } };
  }

  const { name, args } = raw;

  if (name === 'dbgenerated') {
    return { default: { kind: 'expr', expr: 'dbgenerated', args: [...args] } };
  }

  const idFormat = ID_FORMATS[name];
  if (idFormat !== undefined) {
    const format: StringFormat =
      name === 'cuid' && args[0] === 2 ? 'cuid2' : idFormat;
    return { default: { kind: 'expr', expr: `${name}()` }, format };
  }

  // now(), autoincrement(), nanoid(), and any other bare call
  return { default: { kind: 'expr', expr: `${name}()` } };
}
