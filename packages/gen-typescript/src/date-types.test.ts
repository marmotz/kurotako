/** `dateType` and the `Read` variant of the emitted TypeScript declarations. */
import { createSourceIR } from '@kurotako/ir';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { TypeScriptGeneratorOptions } from './options.js';
import { accountSource } from './testing/dates.js';
import { fileEndingWith, noopLogger, runGenerator } from './testing/helpers.js';
import { irOf } from './testing/ir.js';

function emit(options: TypeScriptGeneratorOptions = {}) {
  return runGenerator(irOf(accountSource()), noopLogger, 'typescript', options);
}

function block(source: string, name: string): string {
  const start = source.indexOf(`export type ${name} = `);
  return source.slice(start, source.indexOf('\n};', start) + 3);
}

describe('TypeScriptGeneratorOptions', () => {
  it('accepts no option, and each date type', () => {
    expect(v.parse(TypeScriptGeneratorOptions, {})).toEqual({});
    for (const dateType of ['date', 'string', 'temporal']) {
      expect(v.parse(TypeScriptGeneratorOptions, { dateType })).toEqual({
        dateType,
      });
    }
  });

  it('rejects an unknown date type', () => {
    expect(() =>
      v.parse(TypeScriptGeneratorOptions, { dateType: 'moment' }),
    ).toThrow();
  });
});

describe('dateType option', () => {
  it("'date' (default) types timestamps as Date", () => {
    const user = fileEndingWith(emit().files, 'User.type.ts');
    expect(block(user, 'UserDto')).toContain('createdAt?: Date;');
    expect(block(user, 'UserDto')).toContain('wakeAt?: Date;');
    expect(fileEndingWith(emit().files, 'filters.ts')).toContain(
      'export interface DateTimeFilter {\n  equals?: Date;',
    );
  });

  it("'string' types every date-like field as string", () => {
    const out = emit({ dateType: 'string' });
    const dto = block(fileEndingWith(out.files, 'User.type.ts'), 'UserDto');
    expect(dto).toContain('createdAt?: string;');
    expect(dto).toContain('birthday: string | null;');
    expect(dto).toContain('wakeAt?: string;');
    expect(fileEndingWith(out.files, 'filters.ts')).toContain(
      'export interface DateTimeFilter {\n  equals?: string;',
    );
  });

  it("'temporal' types each field with its Temporal class and splits the filters", () => {
    const out = emit({ dateType: 'temporal' });
    const dto = block(fileEndingWith(out.files, 'User.type.ts'), 'UserDto');
    expect(dto).toContain('createdAt?: Temporal.Instant;');
    expect(dto).toContain('birthday: Temporal.PlainDate | null;');
    expect(dto).toContain('wakeAt?: Temporal.PlainTime;');
    const filters = fileEndingWith(out.files, 'filters.ts');
    expect(filters).toContain(
      'export interface InstantFilter {\n  equals?: Temporal.Instant;',
    );
    expect(filters).toContain('export interface PlainDateFilter');
    expect(filters).toContain('export interface PlainTimeFilter');
    expect(filters).not.toContain('DateTimeFilter');
    const where = block(
      fileEndingWith(out.files, 'User.type.ts'),
      'UserWhereDto',
    );
    expect(where).toContain('createdAt?: InstantFilter;');
    expect(where).toContain('birthday?: PlainDateFilter;');
  });

  it('applies to type aliases and nested array/union members', () => {
    const source = createSourceIR({ namespace: 'acc', parser: 'test' })
      .addTypeAlias('Moment', (t) => t.scalar('datetime'))
      .build();
    const out = runGenerator(irOf(source), noopLogger, 'typescript', {
      dateType: 'temporal',
    });
    expect(fileEndingWith(out.files, 'aliases.ts')).toContain(
      'export type Moment = Temporal.Instant;',
    );
  });
});

describe('Read variant', () => {
  const user = fileEndingWith(emit().files, 'User.type.ts');

  it('omits hidden fields and requires defaulted ones', () => {
    const read = block(user, 'UserReadDto');
    expect(read).not.toContain('passwordHash');
    expect(read).toContain('  id: string;');
    expect(read).toContain('createdAt: Date;');
    expect(read).toContain('seenAt?: Date;');
    expect(block(user, 'UserDto')).toContain('passwordHash: string;');
    expect(block(user, 'UserDto')).toContain('id?: string;');
  });

  it('has a deep sibling pointing at the target Read types', () => {
    expect(block(user, 'UserReadDeepDto')).toContain(
      'posts?: PostReadDeepDto[];',
    );
    expect(
      block(fileEndingWith(emit().files, 'Post.type.ts'), 'PostReadDeepDto'),
    ).toContain('author: UserReadDeepDto;');
  });

  it('is exported through the barrel (type * re-export of the entity module)', () => {
    expect(fileEndingWith(emit().files, 'index.ts')).toContain(
      "export type * from './User.type.js';",
    );
  });
});
