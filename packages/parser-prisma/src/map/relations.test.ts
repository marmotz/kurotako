import { describe, expect, it } from 'vitest';
import { getModel } from '../testing/dmmf.js';
import { buildRelations } from './relations.js';

describe('buildRelations — normal relations', () => {
  it('pairs a 1-n: owning side carries fk/references, other carries backRelation', async () => {
    const model = await getModel(`
      model User {
        id    Int    @id
        posts Post[]
      }
      model Post {
        id       Int  @id
        author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
        authorId Int
      }
    `);
    const { relations, syntheticEntities } = buildRelations(model);
    expect(syntheticEntities).toEqual([]);

    const author = relations.get('Post')?.[0];
    expect(author).toMatchObject({
      name: 'author',
      cardinality: 'one',
      owning: true,
      fkFields: ['authorId'],
      references: ['id'],
      backRelation: 'posts',
      onDelete: 'cascade',
      target: { namespace: '', entity: 'User' },
    });

    const posts = relations.get('User')?.[0];
    expect(posts).toMatchObject({
      name: 'posts',
      cardinality: 'many',
      owning: false,
      backRelation: 'author',
    });
  });

  it('marks an optional to-one relation optional', async () => {
    const model = await getModel(`
      model User {
        id       Int      @id
        profile  Profile?
      }
      model Profile {
        id     Int  @id
        user   User @relation(fields: [userId], references: [id])
        userId Int  @unique
      }
    `);
    const { relations } = buildRelations(model);
    expect(relations.get('User')?.[0]).toMatchObject({
      name: 'profile',
      cardinality: 'one',
      optional: true,
      owning: false,
    });
  });

  it('leaves an explicit m2m join model as two ordinary 1-n relations', async () => {
    const model = await getModel(`
      model Post {
        id      Int          @id
        tags    TagsOnPosts[]
      }
      model Tag {
        id      Int          @id
        posts   TagsOnPosts[]
      }
      model TagsOnPosts {
        post   Post @relation(fields: [postId], references: [id])
        postId Int
        tag    Tag  @relation(fields: [tagId], references: [id])
        tagId  Int
        @@id([postId, tagId])
      }
    `);
    const { syntheticEntities, relations } = buildRelations(model);
    expect(syntheticEntities).toEqual([]);
    expect(
      relations
        .get('TagsOnPosts')
        ?.map((r) => r.name)
        .sort(),
    ).toEqual(['post', 'tag']);
  });
});

describe('buildRelations — implicit m2m materialisation', () => {
  it('materialises a synthetic join entity with a sorted name', async () => {
    const model = await getModel(`
      model Post {
        id   Int   @id
        tags Tag[]
      }
      model Tag {
        id    Int    @id
        posts Post[]
      }
    `);
    const { relations, syntheticEntities } = buildRelations(model);

    expect(syntheticEntities).toHaveLength(1);
    const synthetic = syntheticEntities[0];
    expect(synthetic?.name).toBe('PostTag');
    expect(synthetic?.fields.map((f) => f.name)).toEqual(['postId', 'tagId']);
    expect(synthetic?.fields.map((f) => f.scalar)).toEqual(['int', 'int']);
    expect(synthetic?.primaryKey).toEqual(['postId', 'tagId']);
    expect(synthetic?.relations.map((r) => r.name)).toEqual(['post', 'tag']);
    expect(
      synthetic?.relations.every((r) => r.owning && r.cardinality === 'one'),
    ).toBe(true);
    expect(synthetic?.relations[0]).toMatchObject({
      fkFields: ['postId'],
      references: ['id'],
      onDelete: 'cascade',
      target: { entity: 'Post' },
    });

    expect(relations.get('Post')?.[0]).toMatchObject({
      name: 'tags',
      cardinality: 'many',
      owning: false,
      backRelation: 'post',
      target: { entity: 'PostTag' },
    });
    expect(relations.get('Tag')?.[0]).toMatchObject({
      name: 'posts',
      cardinality: 'many',
      backRelation: 'tag',
      target: { entity: 'PostTag' },
    });
  });

  it('uses a non-default @relation name for the synthetic entity', async () => {
    const model = await getModel(`
      model User {
        id     Int    @id
        groups Group[] @relation("Membership")
      }
      model Group {
        id      Int    @id
        members User[] @relation("Membership")
      }
    `);
    const { syntheticEntities } = buildRelations(model);
    expect(syntheticEntities[0]?.name).toBe('Membership');
  });
});
