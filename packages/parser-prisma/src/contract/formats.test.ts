import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noopLogger, type ParseContext } from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import { readContract } from './read.js';

const load = (name: string): string =>
  readFileSync(join(import.meta.dirname, '__fixtures__', name), 'utf8');

const ctx: ParseContext = {
  namespace: 'pg',
  cwd: process.cwd(),
  logger: noopLogger,
};

// Same contract.prisma emitted by prisma 8.0.0-rc.13 (ref: namespace/table/column)
// and 8.0.0-rc.22 (ref: namespace/entry/field, table names no longer lowercased).
const rc13 = load('contract.rc13.json');
const rc22 = load('contract.rc22.json');

describe('Prisma 8 contract formats', () => {
  it('reads the rc.13 format', () => {
    expect(() => readContract(rc13, ctx, {})).not.toThrow();
  });

  it('reads the rc.22 format', () => {
    expect(() => readContract(rc22, ctx, {})).not.toThrow();
  });

  it('maps models and fields identically, except for the physical table name', () => {
    const strip = (raw: string) =>
      readContract(raw, ctx, {}).model.entities.map(
        ({ dbName: _dbName, indexes, ...entity }) => ({
          ...entity,
          // Prisma derives index names from the physical table name.
          indexes: indexes.map(({ name: _name, ...index }) => index),
        }),
      );
    expect(strip(rc22)).toEqual(strip(rc13));
  });

  it('keeps generator defaults, now() defaults, uniques and optionals in both formats', () => {
    for (const raw of [rc13, rc22]) {
      const { model } = readContract(raw, ctx, {});
      const task = model.entities.find((entity) => entity.name === 'Task');
      const user = model.entities.find((entity) => entity.name === 'User');
      const field = (entity: typeof task, name: string) =>
        entity?.fields.find((candidate) => candidate.name === name);
      expect(field(task, 'id')?.hasDefaultValue).toBe(true);
      expect(field(task, 'done')?.hasDefaultValue).toBe(true);
      expect(field(task, 'createdAt')?.hasDefaultValue).toBe(true);
      expect(field(task, 'assigneeId')?.isRequired).toBe(false);
      expect(field(user, 'email')?.isUnique).toBe(true);
      expect(field(user, 'name')?.isRequired).toBe(false);
      expect(
        task?.relationEdges.find((edge) => edge.fieldName === 'project'),
      ).toMatchObject({ fromFields: ['projectId'], toFields: ['id'] });
    }
  });

  it('reports the physical table name as written by each format', () => {
    const dbName = (raw: string) =>
      readContract(raw, ctx, {}).model.entities.find((e) => e.name === 'User')
        ?.dbName;
    expect(dbName(rc13)).toBe('user');
    expect(dbName(rc22)).toBeUndefined();
  });
});
