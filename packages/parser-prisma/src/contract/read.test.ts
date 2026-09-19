import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { noopLogger, type ParseContext } from '@kurotako/core';
import { describe, expect, it } from 'vitest';
import { PrismaAmbiguousRelationError } from '../errors.js';
import { readContract } from './read.js';

const fixture = readFileSync(
  join(import.meta.dirname, '__fixtures__', 'contract.json'),
  'utf8',
);
const ctx: ParseContext = {
  namespace: 'pg',
  cwd: process.cwd(),
  logger: noopLogger,
};

function withoutAmbiguousBillingUser(): string {
  const contract = JSON.parse(fixture) as {
    domain: { namespaces: { billing: { models: Record<string, unknown> } } };
  };
  delete contract.domain.namespaces.billing.models.User;
  return JSON.stringify(contract);
}

describe('readContract', () => {
  it('reads the captured contract into PrismaModel', () => {
    const { model, generatorVersion } = readContract(
      withoutAmbiguousBillingUser(),
      ctx,
      {},
    );
    expect(generatorVersion).toBe('1');
    const user = model.entities.find((entity) => entity.name === 'User');
    expect(user?.primaryKey).toEqual(['id']);
    expect(user?.uniques).toContainEqual({ fields: ['email'] });
    expect(
      model.enums.find((item) => item.name === 'UserRole')?.values,
    ).toEqual([{ name: 'USER' }, { name: 'ADMIN' }]);

    const post = model.entities.find((entity) => entity.name === 'Post');
    expect(post?.indexes).toContainEqual({
      kind: 'columns',
      fields: ['authorId'],
      name: 'post_authorId_idx_e47547ed',
    });
    expect(post?.indexes).toContainEqual(
      expect.objectContaining({ fields: ['authorId', 'published'] }),
    );
    expect(post?.indexes).toContainEqual({
      kind: 'expression',
      expression:
        "to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))",
      name: 'post_search_fts_9c1a2b3d',
      type: 'gin',
    });
    expect(
      post?.relationEdges.find((edge) => edge.fieldName === 'author'),
    ).toMatchObject({ fromFields: ['authorId'], toFields: ['id'] });

    const tag = model.entities.find((entity) => entity.name === 'Tag');
    expect(tag?.uniques).toContainEqual({ fields: ['name'] });
    expect(tag?.fields.find((field) => field.name === 'name')?.isUnique).toBe(
      true,
    );

    const postTag = model.entities.find((entity) => entity.name === 'PostTag');
    expect(postTag?.primaryKey).toEqual(['postId', 'tagId']);
  });

  it('rejects the namespace ambiguity emitted by Prisma 8 RC', () => {
    expect(() => readContract(fixture, ctx, {})).toThrow(
      PrismaAmbiguousRelationError,
    );
  });
});
