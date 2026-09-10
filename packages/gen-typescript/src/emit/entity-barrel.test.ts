import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { entityOf } from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { emitBarrel } from './barrel.js';
import { emitEntity } from './entity.js';

describe('emitEntity', () => {
  const source = blogSource();
  const output = emitEntity(source, entityOf(source, 'User'));

  it('emits the complete flat/deep type matrix with sorted type imports', () => {
    for (const name of [
      'UserDto',
      'UserDeepDto',
      'UserCreateDto',
      'UserCreateDeepDto',
      'UserUpdateDto',
      'UserUpdateDeepDto',
      'UserWhereDto',
      'UserWhereDeepDto',
      'UserSelectDto',
      'UserSelectDeepDto',
    ]) {
      expect(output).toContain(`export type ${name} =`);
    }
    const imports = output
      .split('\n')
      .filter((line) => line.startsWith('import type'));
    const specifiers = imports.map(
      (line) => line.match(/from '([^']+)'/)?.[1] ?? '',
    );
    expect(specifiers).toEqual(
      [...specifiers].sort((left, right) => left.localeCompare(right)),
    );
  });

  it('keeps flat relations as FKs and gives deep variants named sibling types', () => {
    const flat = output.slice(
      output.indexOf('export type UserDto'),
      output.indexOf('export type UserDeepDto'),
    );
    const deep = output.slice(
      output.indexOf('export type UserDeepDto'),
      output.indexOf('export type UserCreateDto'),
    );
    expect(flat).not.toContain('PostDeepDto');
    expect(deep).toContain('posts?: PostDeepDto[];');
  });

  it('renders update, where and select payload shapes', () => {
    const update = output.slice(
      output.indexOf('export type UserUpdateDto'),
      output.indexOf('export type UserUpdateDeepDto'),
    );
    expect(update).toContain('export type UserUpdateDto = Partial<{');
    expect(update).not.toContain('id:');
    expect(output).toContain('email?: StringFilter;');
    expect(output).toContain('AND?: UserWhereDto | UserWhereDto[];');
    expect(output).toContain('posts?: boolean;');
    expect(output).toContain('posts?: boolean | PostSelectDeepDto;');
  });
});

describe('emitEntity — typed maps', () => {
  it('renders map fields and a compatible index signature', () => {
    const source = createSourceIR({ namespace: 'api', parser: 'openapi' })
      .addEntity('Bag', (entity) => {
        entity.field('labels', (field) =>
          field.map((value) => value.scalar('string')),
        );
        entity.additionalProperties((value) => value.scalar('int'));
      })
      .build();
    const output = emitEntity(source, entityOf(source, 'Bag'));
    expect(output).toContain('labels: Record<string, string>;');
    expect(output).toContain(
      '[key: string]: number | Record<string, string> | undefined;',
    );
  });
});

describe('emitBarrel', () => {
  it('re-exports shared and entity files', () => {
    expect(emitBarrel(blogSource(), true)).toContain(
      "export type * from './scalars';",
    );
    expect(emitBarrel(blogSource(), true)).toContain(
      "export type * from './User.type';",
    );
  });

  it('keeps an empty source valid', () => {
    const source = createSourceIR({
      namespace: 'empty',
      parser: 'test',
    }).build();
    expect(emitBarrel(source, false)).toBe("export * from './enums';\n");
  });
});
