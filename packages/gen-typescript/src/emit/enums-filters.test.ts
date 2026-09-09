import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { TypeScriptEnumCollisionError } from '../errors.js';
import { blogSource } from '../testing/ir.js';
import { emitEnums } from './enums.js';
import { emitFilters } from './filters.js';

describe('emitEnums', () => {
  it('emits const arrays and same-name type aliases, including local enums', () => {
    const source = createSourceIR({ namespace: 'x', parser: 'test' })
      .addEntity('Item', (entity) => {
        entity.localEnum('State', (enumeration) => enumeration.value('DRAFT'));
        entity.field('state', (field) => field.enum('State'));
      })
      .build();
    expect(emitEnums(source)).toBe(
      'export const State = ["DRAFT"] as const;\nexport type State = (typeof State)[number];\n',
    );
  });

  it('rejects distinct definitions sharing an enum name', () => {
    const source = createSourceIR({ namespace: 'x', parser: 'test' })
      .addEnum('Role', (enumeration) => enumeration.value('USER'))
      .addEntity('User', (entity) => {
        entity.localEnum('Role', (enumeration) => enumeration.value('ADMIN'));
      })
      .build();
    expect(() => emitEnums(source)).toThrow(TypeScriptEnumCollisionError);
  });
});

describe('emitFilters', () => {
  it('emits only used scalar classes and enum filters with a type-only import', () => {
    const filters = emitFilters(blogSource());
    expect(filters).toContain("import type { Role } from './enums';");
    expect(filters).toContain('export interface StringFilter');
    expect(filters).toContain('export interface BoolFilter');
    expect(filters).toContain('export interface EnumRoleFilter');
    expect(filters).toContain('in?: string[];');
    expect(filters).not.toContain('export interface DateTimeFilter');
    expect(filters).not.toContain('JsonValue');
  });
});
