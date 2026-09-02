import { describe, expect, it } from 'vitest';
import type { Entity, IR, SourceIR } from './types.js';
import {
  assertIR,
  type IrIssueCode,
  IrValidationError,
  parseIR,
  validateIR,
  validateSourceIR,
} from './validate.js';

/** A fresh, fully valid IR for each test to mutate. */
function makeIr(): IR {
  return {
    irVersion: '1',
    sources: {
      pg: {
        namespace: 'pg',
        parser: 'prisma',
        entities: {
          User: {
            name: 'User',
            fields: [
              {
                name: 'id',
                type: { kind: 'scalar', scalar: 'uuid' },
                list: false,
                optional: false,
                nullable: false,
                constraints: {},
              },
              {
                name: 'email',
                type: { kind: 'scalar', scalar: 'string' },
                list: false,
                optional: false,
                nullable: false,
                constraints: {
                  format: 'email',
                  unique: true,
                  minLength: 3,
                  maxLength: 320,
                },
              },
              {
                name: 'role',
                type: { kind: 'enum', ref: 'Role' },
                list: false,
                optional: false,
                nullable: false,
                constraints: {},
              },
            ],
            relations: [
              {
                name: 'posts',
                target: { namespace: 'pg', entity: 'Post' },
                cardinality: 'many',
                optional: false,
                owning: false,
                backRelation: 'author',
              },
            ],
            primaryKey: ['id'],
            indexes: [{ fields: ['email'] }],
            uniques: [],
          },
          Post: {
            name: 'Post',
            fields: [
              {
                name: 'id',
                type: { kind: 'scalar', scalar: 'uuid' },
                list: false,
                optional: false,
                nullable: false,
                constraints: {},
              },
              {
                name: 'authorId',
                type: { kind: 'scalar', scalar: 'uuid' },
                list: false,
                optional: false,
                nullable: false,
                constraints: {},
              },
            ],
            relations: [
              {
                name: 'author',
                target: { namespace: 'pg', entity: 'User' },
                cardinality: 'one',
                optional: false,
                owning: true,
                backRelation: 'posts',
                fkFields: ['authorId'],
                references: ['id'],
              },
            ],
            primaryKey: ['id'],
            indexes: [],
            uniques: [{ fields: ['authorId'] }],
          },
        },
        enums: {
          Role: {
            name: 'Role',
            values: [{ name: 'USER' }, { name: 'ADMIN', dbName: 'admin' }],
          },
        },
      },
    },
  };
}

function pgOf(ir: IR): SourceIR {
  const pg = ir.sources.pg;
  if (pg === undefined) {
    throw new Error('fixture: missing pg source');
  }
  return pg;
}

function entityOf(source: SourceIR, name: string): Entity {
  const entity = source.entities[name];
  if (entity === undefined) {
    throw new Error(`fixture: missing entity ${name}`);
  }
  return entity;
}

function codesOf(value: unknown): IrIssueCode[] {
  const res = validateIR(value);
  return res.ok ? [] : res.issues.map((i) => i.code);
}

describe('validateIR — baseline', () => {
  it('accepts a valid IR', () => {
    expect(validateIR(makeIr()).ok).toBe(true);
  });

  it('validateSourceIR accepts the source in isolation', () => {
    expect(validateSourceIR(pgOf(makeIr())).ok).toBe(true);
  });

  it('parseIR round-trips deep-equal', () => {
    const ir = makeIr();
    expect(parseIR(JSON.stringify(ir))).toEqual(ir);
  });

  it('assertIR throws IrValidationError carrying issues', () => {
    try {
      assertIR({ irVersion: '1', sources: 'nope' });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(IrValidationError);
      expect((err as IrValidationError).issues.length).toBeGreaterThan(0);
    }
  });
});

describe('validateIR — one failing fixture per IrIssueCode', () => {
  it('shape', () => {
    const ir = makeIr();
    entityOf(pgOf(ir), 'User').fields = 'not-an-array' as never;
    expect(codesOf(ir)).toContain('shape');
  });

  it('version_incompatible', () => {
    const ir = makeIr();
    ir.irVersion = '2';
    expect(codesOf(ir)).toContain('version_incompatible');
  });

  it('namespace_key_mismatch', () => {
    const ir = makeIr();
    pgOf(ir).namespace = 'other';
    expect(codesOf(ir)).toContain('namespace_key_mismatch');
  });

  it('entity_key_mismatch', () => {
    const ir = makeIr();
    entityOf(pgOf(ir), 'User').name = 'Renamed';
    expect(codesOf(ir)).toContain('entity_key_mismatch');
  });

  it('duplicate_field', () => {
    const ir = makeIr();
    const user = entityOf(pgOf(ir), 'User');
    const first = user.fields[0];
    if (first !== undefined) {
      user.fields.push({ ...first });
    }
    expect(codesOf(ir)).toContain('duplicate_field');
  });

  it('duplicate_enum_value', () => {
    const ir = makeIr();
    const role = pgOf(ir).enums.Role;
    role?.values.push({ name: 'USER' });
    expect(codesOf(ir)).toContain('duplicate_enum_value');
  });

  it('unresolved_enum_ref', () => {
    const ir = makeIr();
    const field = entityOf(pgOf(ir), 'User').fields[2];
    if (field !== undefined) {
      field.type = { kind: 'enum', ref: 'Missing' };
    }
    expect(codesOf(ir)).toContain('unresolved_enum_ref');
  });

  it('unresolved_field_ref', () => {
    const ir = makeIr();
    entityOf(pgOf(ir), 'User').primaryKey = ['nope'];
    expect(codesOf(ir)).toContain('unresolved_field_ref');
  });

  it('unresolved_relation_target', () => {
    const ir = makeIr();
    const rel = entityOf(pgOf(ir), 'User').relations[0];
    if (rel !== undefined) {
      rel.target = { namespace: 'pg', entity: 'Ghost' };
    }
    expect(codesOf(ir)).toContain('unresolved_relation_target');
  });

  it('unresolved_back_relation', () => {
    const ir = makeIr();
    const rel = entityOf(pgOf(ir), 'User').relations[0];
    if (rel !== undefined) {
      rel.backRelation = 'missingInverse';
    }
    expect(codesOf(ir)).toContain('unresolved_back_relation');
  });

  it('invalid_constraint', () => {
    const ir = makeIr();
    const field = entityOf(pgOf(ir), 'User').fields[1];
    if (field !== undefined) {
      field.constraints = { min: 10, max: 1 };
    }
    expect(codesOf(ir)).toContain('invalid_constraint');
  });

  it('invalid_regex', () => {
    const ir = makeIr();
    const field = entityOf(pgOf(ir), 'User').fields[1];
    if (field !== undefined) {
      field.constraints = { regex: '(' };
    }
    expect(codesOf(ir)).toContain('invalid_regex');
  });
});

describe('cross-source relations', () => {
  it('an absent target namespace is informational, not an error', () => {
    const ir = makeIr();
    const rel = entityOf(pgOf(ir), 'User').relations[0];
    if (rel !== undefined) {
      rel.target = { namespace: '', entity: 'Elsewhere' };
      rel.backRelation = undefined;
    }
    expect(validateIR(ir).ok).toBe(true);
  });

  it('issue paths are dotted and located', () => {
    const ir = makeIr();
    entityOf(pgOf(ir), 'User').primaryKey = ['nope'];
    const res = validateIR(ir);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.issues.some((i) => i.path === 'pg.User.primaryKey')).toBe(
        true,
      );
    }
  });
});
