import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { blogSource } from '../testing/ir.js';
import { emitFilters } from './filters.js';

describe('emitFilters', () => {
  it('emits only the scalar classes actually used', () => {
    // blog: string/uuid, int, datetime, boolean, enum Role — no float/bigint
    const out = emitFilters(blogSource(), dialectFor(4));
    expect(out).toContain('export const StringFilter');
    expect(out).toContain('export const IntFilter');
    expect(out).toContain('export const DateTimeFilter');
    expect(out).toContain('export const BoolFilter');
    expect(out).not.toContain('FloatFilter');
    expect(out).not.toContain('BigIntFilter');
  });

  it('StringFilter carries string ops, IntFilter does not', () => {
    const out = emitFilters(blogSource(), dialectFor(4));
    const str = out.slice(
      out.indexOf('StringFilter'),
      out.indexOf('IntFilter'),
    );
    expect(str).toContain('contains:');
    const int = out.slice(out.indexOf('IntFilter'));
    expect(int.slice(0, int.indexOf('DateTimeFilter'))).not.toContain(
      'contains:',
    );
  });

  it('Enum<Name>Filter imports the enum and switches on zodVersion', () => {
    const out4 = emitFilters(blogSource(), dialectFor(4));
    expect(out4).toContain("import { RoleSchema } from './enums';");
    expect(out4).toContain('export const EnumRoleFilter');
    expect(out4).toContain('equals: RoleSchema.optional()');
    expect(out4).toContain('equals: z.int().optional()');

    const out3 = emitFilters(blogSource(), dialectFor(3));
    expect(out3).toContain('equals: z.number().int().optional()');
  });

  it('no enum used -> no ./enums import', () => {
    const src = createSourceIR({ namespace: 'x', parser: 't' })
      .addEntity('T', (t) => t.field('id', (f) => f.scalar('int').primary()))
      .build();
    expect(emitFilters(src, dialectFor(4))).not.toContain("from './enums'");
  });
});
