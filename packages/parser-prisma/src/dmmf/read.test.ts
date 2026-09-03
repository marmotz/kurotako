import { describe, expect, it } from 'vitest';
import { getModel } from '../testing/dmmf.js';

describe('toPrismaModel', () => {
  it('splits scalar/enum fields from relation edges and lifts enums', async () => {
    const model = await getModel(`
      enum Role {
        USER
        ADMIN
      }
      model User {
        id    Int    @id
        name  String
        role  Role   @default(USER)
        posts Post[]
      }
      model Post {
        id       Int  @id
        author   User @relation(fields: [authorId], references: [id])
        authorId Int
      }
    `);

    const user = model.entities.find((e) => e.name === 'User');
    expect(user?.fields.map((f) => f.name)).toEqual(['id', 'name', 'role']);
    expect(user?.fields.find((f) => f.name === 'role')?.kind).toBe('enum');
    expect(user?.relationEdges.map((r) => r.fieldName)).toEqual(['posts']);
    expect(model.enums.map((e) => e.name)).toEqual(['Role']);

    const post = model.entities.find((e) => e.name === 'Post');
    const edge = post?.relationEdges.find((r) => r.fieldName === 'author');
    expect(edge?.fromFields).toEqual(['authorId']);
    expect(edge?.toFields).toEqual(['id']);
  });

  it('reads composite primary keys and composite uniques', async () => {
    const model = await getModel(`
      model Membership {
        userId Int
        orgId  Int
        label  String
        note   String
        @@id([userId, orgId])
        @@unique([label, note])
      }
    `);
    const entity = model.entities[0];
    expect(entity?.primaryKey).toEqual(['userId', 'orgId']);
    expect(entity?.uniques).toEqual([{ fields: ['label', 'note'] }]);
  });

  it('carries /// docs and @@map verbatim', async () => {
    const model = await getModel(`
      /// a person
      model User {
        id   Int    @id
        /// their display name
        name String
        @@map("users")
      }
      /// the role set
      enum Role {
        USER
      }
    `);
    const user = model.entities[0];
    expect(user?.doc).toBe('a person');
    expect(user?.dbName).toBe('users');
    expect(user?.fields.find((f) => f.name === 'name')?.doc).toBe(
      'their display name',
    );
    expect(model.enums[0]?.doc).toBe('the role set');
  });

  it('exposes non-unique @@index from datamodel.indexes', async () => {
    const model = await getModel(`
      model User {
        id    Int    @id
        name  String
        email String
        @@index([name])
      }
    `);
    expect(model.entities[0]?.indexes).toEqual([{ fields: ['name'] }]);
  });
});
