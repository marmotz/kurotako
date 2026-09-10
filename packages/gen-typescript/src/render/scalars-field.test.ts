import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { entityOf, fieldOf } from '../testing/helpers.js';
import { blogSource } from '../testing/ir.js';
import { memberLine } from './field.js';
import { jsDoc } from './jsdoc.js';
import { fieldTsType } from './scalars.js';

describe('fieldTsType and memberLine', () => {
  it('uses the IR scalarTsType mapping for every scalar class', () => {
    const source = createSourceIR({ namespace: 'types', parser: 'test' })
      .addEntity('Values', (entity) => {
        for (const scalar of [
          'string',
          'uuid',
          'decimal',
          'boolean',
          'int',
          'float',
          'bigint',
          'date',
          'datetime',
          'bytes',
          'json',
        ] as const) {
          entity.field(scalar, (field) => field.scalar(scalar));
        }
      })
      .build();
    const entity = entityOf(source, 'Values');
    expect(
      entity.fields.map((field) => fieldTsType(field, source, entity)),
    ).toEqual([
      'string',
      'string',
      'string',
      'boolean',
      'number',
      'number',
      'bigint',
      'Date',
      'Date',
      'Uint8Array',
      'JsonValue',
    ]);
  });

  it('resolves enum types and assembles list, nullable and optional wrappers', () => {
    const source = blogSource();
    const entity = entityOf(source, 'User');
    const role = fieldOf(entity, 2);
    expect(fieldTsType(role, source, entity)).toBe('Role');
    expect(
      memberLine(
        { ...role, name: 'roles', list: true, nullable: true },
        { optional: true },
        source,
        entity,
      ),
    ).toContain('roles?: Role[] | null;');
    expect(
      memberLine(
        {
          ...role,
          list: true,
          type: {
            kind: 'union',
            variants: [
              { kind: 'scalar', scalar: 'string' },
              { kind: 'scalar', scalar: 'int' },
            ],
          },
        },
        { optional: false },
        source,
        entity,
      ),
    ).toContain(`role: (string | number)[];`);
  });

  it('renders flattened empty unions as unknown for fields', () => {
    const source = createSourceIR({ namespace: 'types', parser: 'test' })
      .addEntity('Record', (entity) => {
        entity.field('value', (field) => field.scalar('string'));
      })
      .build();
    const entity = entityOf(source, 'Record');
    const field = fieldOf(entity, 0);
    field.type = {
      kind: 'union',
      variants: [{ kind: 'union', variants: [] }],
    };

    expect(fieldTsType(field, source, entity)).toBe('unknown');
    expect(memberLine(field, { optional: false }, source, entity)).toBe(
      '  value: unknown;',
    );
  });

  it('renders typed maps recursively', () => {
    const source = createSourceIR({ namespace: 'types', parser: 'test' })
      .addEntity('Record', (entity) => {
        entity.field('labels', (field) =>
          field.map((value) => value.map((nested) => nested.scalar('string'))),
        );
      })
      .build();
    const entity = entityOf(source, 'Record');
    expect(fieldTsType(fieldOf(entity, 0), source, entity)).toBe(
      'Record<string, Record<string, string>>',
    );
  });

  it('renders array field types recursively, parenthesising a union element', () => {
    const source = createSourceIR({ namespace: 'types', parser: 'test' })
      .addEntity('Board', (entity) => {
        entity.field('grid', (field) =>
          field.array((row) => row.array((cell) => cell.scalar('int'))),
        );
        entity.field('mixed', (field) =>
          field.array((element) =>
            element.union((u) => u.scalar('string').scalar('int')),
          ),
        );
      })
      .build();
    const entity = entityOf(source, 'Board');
    expect(fieldTsType(fieldOf(entity, 0), source, entity)).toBe('number[][]');
    expect(fieldTsType(fieldOf(entity, 1), source, entity)).toBe(
      '(string | number)[]',
    );
  });

  it('renders field prose, constraint/default tags and unknown hints as JSDoc', () => {
    const source = blogSource();
    const entity = entityOf(source, 'User');
    const email = fieldOf(entity, 1);
    expect(jsDoc(email)).toContain('@pattern ^[^@]+@[^@]+$');
    expect(jsDoc(email)).toContain('@unique');
    expect(jsDoc(fieldOf(entity, 2))).toContain('@default "USER"');
    expect(jsDoc(fieldOf(entity, 4))).toContain('unknown: provider payload');
    expect(memberLine(email, { optional: false }, source, entity)).toContain(
      '  email: string;',
    );
  });

  it('omits a JSDoc block when no metadata exists', () => {
    const source = blogSource();
    const entity = entityOf(source, 'Post');
    expect(jsDoc(fieldOf(entity, 1))).toBe('');
  });
});
