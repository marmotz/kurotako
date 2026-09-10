import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type { ParseContext } from '@kurotako/core';
import { noopLogger } from '@kurotako/core';
import {
  IR_VERSION,
  type SourceIR,
  validateIR,
  validateSourceIR,
} from '@kurotako/ir';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaAmbiguousRelationError, PrismaContractError } from './errors.js';
import { prismaParser } from './parser.js';

const PKG_DIR = join(import.meta.dirname, '..');

const SCHEMA = `
datasource db {
  provider = "postgresql"
}

/// the role set
enum Role {
  USER
  ADMIN @map("admin")
}

/// a person
model User {
  id        String   @id @default(uuid()) @db.Uuid
  email     String   @unique @db.VarChar(255)
  name      String?
  role      Role     @default(USER)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  posts     Post[]
  profile   Profile?
  @@map("users")
}

model Profile {
  id     Int     @id @default(autoincrement())
  bio    String?
  user   User    @relation(fields: [userId], references: [id])
  userId String  @unique
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  slug     String @default(cuid())
  author   User   @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId String
  tags     Tag[]
  @@unique([title, authorId])
}

model Tag {
  id    Int    @id
  posts Post[]
}

model Membership {
  userId Int
  orgId  Int
  @@id([userId, orgId])
}
`;

let root: string;

function ctx(cwd: string): ParseContext {
  return { namespace: 'pg', cwd, logger: noopLogger };
}

async function parse(schema = 'schema.prisma'): Promise<SourceIR> {
  return prismaParser.parse(ctx(root), { schema });
}

function entity(ir: SourceIR, name: string) {
  const e = ir.entities[name];
  if (!e) {
    throw new Error(`entity '${name}' not in SourceIR`);
  }
  return e;
}

function enumDef(ir: SourceIR, name: string) {
  const e = ir.enums[name];
  if (!e) {
    throw new Error(`enum '${name}' not in SourceIR`);
  }
  return e;
}

beforeEach(() => {
  root = mkdtempSync(join(PKG_DIR, 'tmp-parser-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('prismaParser.parse — single file', () => {
  beforeEach(() => {
    writeFileSync(join(root, 'schema.prisma'), SCHEMA);
  });

  it('produces a valid SourceIR', async () => {
    const ir = await parse();
    expect(ir.namespace).toBe('pg');
    expect(ir.parser).toBe('prisma');
    expect(ir.parserVersion).toMatch(/^prisma@\d+\./);
    expect(validateSourceIR(ir).ok).toBe(true);
  });

  it('regression: a Prisma-built SourceIR still validates under IR_VERSION 2', async () => {
    const ir = await parse();
    expect(ir.typeAliases).toBeUndefined();
    const wrapped = validateIR({
      irVersion: IR_VERSION,
      sources: { [ir.namespace]: ir },
    });
    expect(IR_VERSION).toBe('2');
    expect(wrapped.ok).toBe(true);
  });

  it('lifts enums to source level with @map on values', async () => {
    const ir = await parse();
    expect(enumDef(ir, 'Role').values).toEqual([
      { name: 'USER' },
      { name: 'ADMIN', dbName: 'admin' },
    ]);
    expect(enumDef(ir, 'Role').doc).toBe('the role set');
  });

  it('maps scalars, native types, optional/nullable and defaults', async () => {
    const user = entity(await parse(), 'User');
    const byName = Object.fromEntries(user.fields.map((f) => [f.name, f]));

    // @db.Uuid promotes the scalar; the redundant uuid format is dropped.
    expect(byName.id).toMatchObject({
      type: { kind: 'scalar', scalar: 'uuid' },
      nullable: false,
      optional: true,
      default: { kind: 'expr', expr: 'uuid()' },
    });
    expect(byName.id?.constraints.format).toBeUndefined();

    expect(byName.email).toMatchObject({
      type: { kind: 'scalar', scalar: 'string' },
      constraints: { maxLength: 255, unique: true },
      optional: false,
      nullable: false,
    });

    // nullable but no default → not optional
    expect(byName.name).toMatchObject({ nullable: true, optional: false });

    expect(byName.role).toMatchObject({
      type: { kind: 'enum', ref: 'Role' },
      optional: true,
      default: { kind: 'value', value: 'USER' },
    });

    expect(byName.createdAt).toMatchObject({ optional: true });
    // @updatedAt → optional even without a DB default
    expect(byName.updatedAt).toMatchObject({ optional: true });
  });

  it('keeps a string scalar with a cuid format from @default(cuid())', async () => {
    const post = entity(await parse(), 'Post');
    const slug = post.fields.find((f) => f.name === 'slug');
    expect(slug).toMatchObject({
      type: { kind: 'scalar', scalar: 'string' },
      constraints: { format: 'cuid' },
      default: { kind: 'expr', expr: 'cuid()' },
    });
  });

  it('maps single, composite and @@unique keys', async () => {
    const ir = await parse();
    expect(entity(ir, 'User').primaryKey).toEqual(['id']);
    expect(entity(ir, 'Membership').primaryKey).toEqual(['userId', 'orgId']);
    expect(entity(ir, 'Post').uniques).toEqual([
      { fields: ['title', 'authorId'] },
    ]);
  });

  it('carries /// docs and @@map verbatim', async () => {
    const ir = await parse();
    expect(entity(ir, 'User').doc).toBe('a person');
    expect(entity(ir, 'User').dbName).toBe('users');
  });

  it('pairs 1-1 and 1-n relations with owning side and back relation', async () => {
    const ir = await parse();
    const author = entity(ir, 'Post').relations.find(
      (r) => r.name === 'author',
    );
    expect(author).toMatchObject({
      cardinality: 'one',
      owning: true,
      fkFields: ['authorId'],
      references: ['id'],
      onDelete: 'cascade',
      backRelation: 'posts',
      target: { namespace: 'pg', entity: 'User' },
    });

    const profile = entity(ir, 'User').relations.find(
      (r) => r.name === 'profile',
    );
    expect(profile).toMatchObject({ cardinality: 'one', optional: true });
  });

  it('materialises the implicit m2m as a synthetic entity', async () => {
    const ir = await parse();
    const synthetic = entity(ir, 'PostTag');
    expect(synthetic.fields.map((f) => f.name)).toEqual(['postId', 'tagId']);
    expect(synthetic.primaryKey).toEqual(['postId', 'tagId']);
    expect(synthetic.relations.map((r) => r.name)).toEqual(['post', 'tag']);

    const postSide = entity(ir, 'Post').relations.find(
      (r) => r.name === 'tags',
    );
    expect(postSide).toMatchObject({
      cardinality: 'many',
      owning: false,
      target: { namespace: 'pg', entity: 'PostTag' },
    });
  });

  it('is deterministic across repeated parses', async () => {
    const a = await parse();
    const b = await parse();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('applies mode-7 rename and warns when namespacePrefix is ignored', async () => {
    const warn = vi.fn();
    const ir = await prismaParser.parse(
      {
        namespace: 'pg',
        cwd: root,
        logger: { debug() {}, info() {}, warn, error() {} },
      },
      {
        schema: 'schema.prisma',
        rename: { User: 'Account' },
        namespacePrefix: { public: 'Public' },
      },
    );
    expect(ir.entities.Account).toBeDefined();
    expect(
      ir.entities.Post?.relations.find((relation) => relation.name === 'author')
        ?.target.entity,
    ).toBe('Account');
    expect(warn).toHaveBeenCalledWith(
      'prisma parser: namespacePrefix is ignored in Prisma 7 mode',
    );
  });
});

describe('prismaParser.parse — multi-file folder', () => {
  it('merges a prismaSchemaFolder into one SourceIR', async () => {
    mkdirSync(join(root, 'prisma'));
    writeFileSync(
      join(root, 'prisma', 'schema.prisma'),
      `datasource db {
        provider = "postgresql"
      }
      model User {
        id    Int    @id
        posts Post[]
      }`,
    );
    writeFileSync(
      join(root, 'prisma', 'post.prisma'),
      `model Post {
        id       Int  @id
        author   User @relation(fields: [authorId], references: [id])
        authorId Int
      }`,
    );

    const ir = await prismaParser.parse(ctx(root), { schema: 'prisma' });
    expect(Object.keys(ir.entities).sort()).toEqual(['Post', 'User']);
    expect(validateSourceIR(ir).ok).toBe(true);
  });
});

describe('prismaParser.parse — Prisma 8 contract', () => {
  it('produces a SourceIR from the captured contract fixture', async () => {
    const fixture = JSON.parse(
      readFileSync(
        join(import.meta.dirname, 'contract', '__fixtures__', 'contract.json'),
        'utf8',
      ),
    ) as {
      domain: { namespaces: { billing: { models: Record<string, unknown> } } };
    };
    // The full fixture intentionally captures Prisma RC's ambiguous homonym
    // bug; remove that one model to exercise the otherwise complete reader.
    delete fixture.domain.namespaces.billing.models.User;
    writeFileSync(join(root, 'contract.json'), JSON.stringify(fixture));

    const ir = await prismaParser.parse(ctx(root), {
      schema: 'contract.json',
      version: 8,
    });
    expect(ir.parserVersion).toBe('prisma-contract@1');
    expect(ir.entities.User?.primaryKey).toEqual(['id']);
    expect(ir.enums.UserRole?.values).toEqual([
      { name: 'USER' },
      { name: 'ADMIN' },
    ]);
    expect(validateSourceIR(ir).ok).toBe(true);
  });

  it('rejects the ambiguous cross-namespace relation in the full fixture', async () => {
    writeFileSync(
      join(root, 'contract.json'),
      readFileSync(
        join(import.meta.dirname, 'contract', '__fixtures__', 'contract.json'),
        'utf8',
      ),
    );
    await expect(
      prismaParser.parse(ctx(root), { schema: 'contract.json', version: 8 }),
    ).rejects.toBeInstanceOf(PrismaAmbiguousRelationError);
  });
});

describe('prismaParser.parse — errors', () => {
  it('rejects an invalid Prisma 8 contract', async () => {
    writeFileSync(
      join(root, 'contract.json'),
      JSON.stringify({
        schemaVersion: '1',
        target: 'postgres',
        targetFamily: 'sql',
        domain: {},
      }),
    );
    await expect(
      prismaParser.parse(ctx(root), { schema: 'contract.json' }),
    ).rejects.toBeInstanceOf(PrismaContractError);
  });
});

describe('prismaParser.anchor', () => {
  it('returns the directory the schema lives in, resolved against rootDir', () => {
    expect(
      prismaParser.anchor?.('/repo', {
        schema: './libs/db/prisma/schema.prisma',
      }),
    ).toBe(join('/repo', 'libs', 'db', 'prisma'));
  });

  it('yields the parent directory for a schema folder', () => {
    expect(prismaParser.anchor?.('/repo', { schema: './libs/db/prisma' })).toBe(
      join('/repo', 'libs', 'db'),
    );
  });
});
