import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { entityOf } from '../testing/helpers.js';
import { blogSource, irOf } from '../testing/ir.js';
import { emitBarrel } from './barrel.js';
import { emitEntity } from './entity.js';

const d = dialectFor(4);

function userFile(): string {
  const source = blogSource();
  const ir = irOf(source);
  return emitEntity(ir, source, entityOf(source, 'User'), d);
}

describe('emitEntity', () => {
  const out = userFile();

  it('emits every variant x family schema + its Dto type', () => {
    // Flat family: no relations rendered, so no circularity risk — plain
    // `export const X = ...` + `export type Dto = z.infer<typeof X>`.
    for (const name of [
      'UserSchema',
      'UserCreateSchema',
      'UserUpdateSchema',
      'UserSelectSchema',
    ]) {
      expect(out).toContain(`export const ${name} = `);
      expect(out).toContain(
        `export type ${name.replace('Schema', 'Dto')} = z.infer<typeof ${name}>;`,
      );
    }
    // Deep family: `User` and `Post` relate to each other, so every deep
    // variant's relation field would make `z.infer` circular. Each gets an
    // explicit `z.ZodType<Dto>` annotation, with `Dto` hand-composed from an
    // unexported, relation-free `<name>Base` (see `emitEntity`'s doc comment).
    for (const name of [
      'UserDeepSchema',
      'UserCreateDeepSchema',
      'UserUpdateDeepSchema',
      'UserWhereSchema',
      'UserWhereDeepSchema',
      'UserSelectDeepSchema',
    ]) {
      const dto = name.replace('Schema', 'Dto');
      expect(out).toContain(`export const ${name}: z.ZodType<${dto}> = `);
      expect(out).toContain(`export type ${dto} = `);
      expect(out).toContain(`z.infer<typeof ${name}Base>`);
    }
  });

  it('the flat record variants contain no z.lazy; the deep ones reference siblings via z.lazy', () => {
    const flatFull = out.slice(
      out.indexOf('export const UserSchema'),
      out.indexOf('export const UserDeepSchema'),
    );
    expect(flatFull).not.toContain('z.lazy');

    const deepFull = out.slice(
      out.indexOf('export const UserDeepSchema'),
      out.indexOf('export const UserCreateSchema'),
    );
    expect(deepFull).toContain(
      'z.array(z.lazy(() => PostDeepSchema)).optional()',
    );
  });

  it('update is a whole-object .partial() without the primary key', () => {
    const upd = out.slice(
      out.indexOf('export const UserUpdateSchema'),
      out.indexOf('export type UserUpdateDto'),
    );
    expect(upd).toContain('}).partial();');
    expect(upd).not.toMatch(/\bid:/);
  });

  it('where wraps each field in its filter schema and adds AND/OR/NOT', () => {
    const where = out.slice(
      out.indexOf('const UserWhereSchemaBase'),
      out.indexOf('export type UserWhereDto'),
    );
    expect(where).toContain('email: StringFilter.optional()');
    expect(where).toContain('role: EnumRoleFilter.optional()');
    expect(where).toContain(
      'AND: z.union([UserWhereSchema, z.array(UserWhereSchema)]).optional()',
    );
  });

  it('select flat is all-boolean; select deep is boolean-or-lazy for relations', () => {
    const selFlat = out.slice(
      out.indexOf('export const UserSelectSchema'),
      out.indexOf('export const UserSelectDeepSchema'),
    );
    expect(selFlat).toContain('posts: z.boolean().optional()');
    const selDeep = out.slice(out.indexOf('export const UserSelectDeepSchema'));
    expect(selDeep).toContain(
      'posts: z.union([z.boolean(), z.lazy(() => PostSelectDeepSchema)]).optional()',
    );
  });

  it('import lines are sorted by specifier', () => {
    const lines = out.split('\n').filter((l) => l.startsWith('import '));
    const specs = lines.map((l) =>
      l.slice(l.indexOf("from '") + 6, l.length - 2),
    );
    expect(specs).toEqual([...specs].sort((a, b) => a.localeCompare(b)));
    expect(specs).toContain('./enums');
    expect(specs).toContain('./filters');
    expect(specs).toContain('./Post.schema');
  });
});

describe('emitBarrel', () => {
  it('re-exports enums, filters and every entity file', () => {
    const out = emitBarrel(blogSource());
    expect(out).toBe(
      "export * from './enums';\n" +
        "export * from './filters';\n" +
        "export * from './User.schema';\n" +
        "export * from './Post.schema';\n",
    );
  });

  it('zero-entity source -> bare index.ts (enums only)', () => {
    const empty = createSourceIR({ namespace: 'x', parser: 't' }).build();
    expect(emitBarrel(empty)).toBe("export * from './enums';\n");
  });
});
