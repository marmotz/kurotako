/**
 * `dateType` and the `Read` variant, checked two ways: on the emitted source
 * text, and by running the emitted schemas against a real Zod 4.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createSourceIR } from '@kurotako/ir';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ZodGeneratorOptions } from './options.js';
import { accountSource } from './testing/dates.js';
import { fileEndingWith, runGenerator } from './testing/helpers.js';
import { irOf } from './testing/ir.js';

function emit(options: ZodGeneratorOptions) {
  return runGenerator(irOf(accountSource()), options);
}

describe('dateType option (emitted source)', () => {
  it("'date' (default) keeps z.coerce.date() and emits no temporal helper", () => {
    const out = emit({ zodVersion: 4 });
    const user = fileEndingWith(out.files, 'User.schema.ts');
    expect(user).toContain('createdAt: z.coerce.date()');
    expect(user).toContain('wakeAt: z.coerce.date().optional()');
    expect(out.files.some((f) => f.path.endsWith('temporal.ts'))).toBe(false);
    expect(fileEndingWith(out.files, 'filters.ts')).toContain(
      'export const DateTimeFilter',
    );
  });

  it("'string' models ISO 8601 strings (zod 4)", () => {
    const user = fileEndingWith(
      emit({ zodVersion: 4, dateType: 'string' }).files,
      'User.schema.ts',
    );
    expect(user).toContain('createdAt: z.iso.datetime()');
    expect(user).toContain('birthday: z.iso.date().nullable()');
    expect(user).toContain('wakeAt: z.iso.time().optional()');
    expect(user).not.toContain('z.coerce.date');
  });

  it("'string' chains the string-format methods on zod 3", () => {
    const user = fileEndingWith(
      emit({ zodVersion: 3, dateType: 'string' }).files,
      'User.schema.ts',
    );
    expect(user).toContain('createdAt: z.string().datetime()');
    expect(user).toContain('birthday: z.string().date().nullable()');
    expect(user).toContain('wakeAt: z.string().time().optional()');
  });

  it("'string' types the hand-written DTOs as string", () => {
    const user = fileEndingWith(
      emit({ zodVersion: 4, dateType: 'string' }).files,
      'User.schema.ts',
    );
    expect(user).not.toContain('Date;');
  });

  it("'temporal' maps each scalar to its Temporal helper and imports it", () => {
    const out = emit({ zodVersion: 4, dateType: 'temporal' });
    const user = fileEndingWith(out.files, 'User.schema.ts');
    expect(user).toContain('createdAt: TemporalInstantSchema');
    expect(user).toContain('birthday: TemporalPlainDateSchema.nullable()');
    expect(user).toContain('wakeAt: TemporalPlainTimeSchema.optional()');
    expect(user).toContain(
      "import { TemporalInstantSchema, TemporalPlainDateSchema, TemporalPlainTimeSchema } from './temporal.js';",
    );
    expect(fileEndingWith(out.files, 'index.ts')).toContain(
      "export * from './temporal.js';",
    );
    // The Post entity has no date field: it must not import the helper.
    expect(fileEndingWith(out.files, 'Post.schema.ts')).not.toContain(
      'temporal',
    );
  });

  it("'temporal' splits the date filter per Temporal class", () => {
    const out = emit({ zodVersion: 4, dateType: 'temporal' });
    const filters = fileEndingWith(out.files, 'filters.ts');
    expect(filters).toContain('export const InstantFilter');
    expect(filters).toContain('export const PlainDateFilter');
    expect(filters).toContain('export const PlainTimeFilter');
    expect(filters).not.toContain('DateTimeFilter');
    const user = fileEndingWith(out.files, 'User.schema.ts');
    expect(user).toContain('createdAt: InstantFilter.optional()');
    expect(user).toContain('birthday: PlainDateFilter.optional()');
  });

  it("'temporal' without any date field emits no helper file", () => {
    const source = createSourceIR({ namespace: 'acc', parser: 'test' })
      .addEntity('Tag', (t) => {
        t.field('label', (f) => f.scalar('string'));
      })
      .build();
    const out = runGenerator(irOf(source), {
      zodVersion: 4,
      dateType: 'temporal',
    });
    expect(out.files.some((f) => f.path.endsWith('/temporal.ts'))).toBe(false);
    expect(fileEndingWith(out.files, 'index.ts')).not.toContain('temporal');
  });

  it('records the date type in the artifact', () => {
    expect(
      (
        emit({ zodVersion: 4, dateType: 'temporal' }).artifact.extra as {
          dateType: string;
        }
      ).dateType,
    ).toBe('temporal');
    expect(
      (emit({ zodVersion: 4 }).artifact.extra as { dateType: string }).dateType,
    ).toBe('date');
  });
});

describe('Read variant (emitted source)', () => {
  const user = fileEndingWith(emit({ zodVersion: 4 }).files, 'User.schema.ts');
  const readBlock = user.slice(
    user.indexOf('export const UserReadSchema'),
    user.indexOf('export type UserReadDto'),
  );

  it('omits hidden fields', () => {
    expect(readBlock).not.toContain('passwordHash');
    expect(user).toContain('passwordHash: z.string()');
  });

  it('makes defaulted fields required, keeps default-less optional ones optional', () => {
    expect(readBlock).toMatch(/\bid: z\.uuid\(\),/);
    expect(readBlock).toContain('createdAt: z.coerce.date(),');
    expect(readBlock).toContain('seenAt: z.coerce.date().optional()');
    // The full schema keeps the source's optionality for those defaulted fields.
    const full = user.slice(
      user.indexOf('export const UserSchema'),
      user.indexOf('export type UserDto'),
    );
    expect(full).toContain('id: z.uuid().optional()');
  });

  it('has a deep sibling whose relations point at the target Read schemas', () => {
    expect(user).toContain('export const UserReadDeepSchema');
    expect(user).toContain(
      'posts: z.array(z.lazy(() => PostReadDeepSchema)).optional()',
    );
    const post = fileEndingWith(
      emit({ zodVersion: 4 }).files,
      'Post.schema.ts',
    );
    expect(post).toContain('author: z.lazy(() => UserReadDeepSchema)');
  });

  it('lists the read roles in the artifact symbols', () => {
    const symbols = emit({ zodVersion: 4 }).artifact.entities['acc.User']
      ?.symbols;
    expect(symbols).toMatchObject({
      readSchema: 'UserReadSchema',
      readType: 'UserReadDto',
      readDeepSchema: 'UserReadDeepSchema',
      readDeepType: 'UserReadDeepDto',
    });
  });
});

// --- run the emitted schemas against a real Zod 4 ---------------------------------

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
let root: string;

async function load(
  options: ZodGeneratorOptions,
  name: string,
  // biome-ignore lint/suspicious/noExplicitAny: the module under test is generated at run time
): Promise<Record<string, any>> {
  const dir = path.join(root, name);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(
    path.join(dir, 'package.json'),
    '{"type":"module"}',
    'utf8',
  );
  for (const file of emit(options).files) {
    const { outputText } = ts.transpileModule(file.content, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022,
      },
    });
    await fs.writeFile(
      path.join(dir, path.basename(file.path).replace(/\.ts$/, '.js')),
      outputText,
      'utf8',
    );
  }
  return import(pathToFileURL(path.join(dir, 'index.js')).href);
}

/**
 * Node 24 has no global `Temporal` (Node 26 does). The generated schemas only need
 * `from` and `instanceof`, so a minimal stand-in keeps the tests runtime-independent.
 */
function installTemporalStandIn(): void {
  const g = globalThis as { Temporal?: unknown };
  if (g.Temporal !== undefined) {
    return;
  }
  const make = (pattern: RegExp) =>
    class {
      constructor(private readonly text: string) {}
      static from(value: unknown): object {
        if (typeof value !== 'string' || !pattern.test(value)) {
          throw new RangeError(`invalid: ${String(value)}`);
        }
        return new this(value);
      }
      toString(): string {
        return this.text;
      }
    };
  g.Temporal = {
    Instant: make(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/),
    PlainDate: make(/^\d{4}-\d{2}-\d{2}$/),
    PlainTime: make(/^\d{2}:\d{2}:\d{2}$/),
  };
}

beforeAll(async () => {
  installTemporalStandIn();
  root = await fs.mkdtemp(path.join(packageDir, 'tmp-dates-'));
});
afterAll(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

// The Temporal types are not in the TypeScript lib this repo compiles against;
// Node provides the runtime global.
declare const Temporal: Record<
  'Instant' | 'PlainDate' | 'PlainTime',
  {
    new (...args: never[]): object;
    from(value: unknown): { toString(): string };
  }
>;

const row = {
  id: '4c0b8a3e-2f3a-4d5a-9c1e-0a1b2c3d4e5f',
  email: 'a@b.c',
  createdAt: '2024-01-02T03:04:05Z',
  birthday: '1990-05-06',
};

describe('dateType option (run against zod)', () => {
  it("'temporal' parses ISO strings and Temporal objects into Temporal objects", async () => {
    const m = await load({ zodVersion: 4, dateType: 'temporal' }, 'temporal');
    const fromHttp = m.UserReadSchema.parse({
      ...row,
      wakeAt: '07:30:00',
    });
    expect(fromHttp.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(fromHttp.createdAt.toString()).toBe('2024-01-02T03:04:05Z');
    expect(fromHttp.birthday).toBeInstanceOf(Temporal.PlainDate);
    expect(fromHttp.wakeAt).toBeInstanceOf(Temporal.PlainTime);

    const instant = Temporal.Instant.from('2025-02-03T04:05:06Z');
    const fromOrm = m.UserReadSchema.parse({ ...row, createdAt: instant });
    expect(fromOrm.createdAt).toBe(instant);
  });

  it("'temporal' reports an unparsable string as an issue instead of throwing", async () => {
    const m = await load(
      { zodVersion: 4, dateType: 'temporal' },
      'temporal-bad',
    );
    const result = m.UserReadSchema.safeParse({ ...row, createdAt: 'nope' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['createdAt']);
    expect(
      m.UserReadSchema.safeParse({ ...row, createdAt: new Date() }).success,
    ).toBe(false);
  });

  it("'temporal' filters accept their own Temporal class", async () => {
    const m = await load(
      { zodVersion: 4, dateType: 'temporal' },
      'temporal-where',
    );
    expect(
      m.UserWhereSchema.parse({ createdAt: { gte: '2024-01-01T00:00:00Z' } })
        .createdAt.gte,
    ).toBeInstanceOf(Temporal.Instant);
    expect(
      m.UserWhereSchema.parse({ birthday: { equals: '1990-05-06' } }).birthday
        .equals,
    ).toBeInstanceOf(Temporal.PlainDate);
  });

  it("'string' accepts ISO strings only", async () => {
    const m = await load({ zodVersion: 4, dateType: 'string' }, 'string');
    expect(
      m.UserReadSchema.parse({ ...row, wakeAt: '07:30:00' }).createdAt,
    ).toBe(row.createdAt);
    expect(
      m.UserReadSchema.safeParse({ ...row, createdAt: new Date() }).success,
    ).toBe(false);
    expect(
      m.UserReadSchema.safeParse({ ...row, createdAt: 'yesterday' }).success,
    ).toBe(false);
  });

  it("'date' still coerces to a Date", async () => {
    const m = await load({ zodVersion: 4 }, 'date');
    expect(m.UserReadSchema.parse(row).createdAt).toBeInstanceOf(Date);
  });
});

describe('Read variant (run against zod)', () => {
  it('requires defaulted fields and strips nothing the source did not hide', async () => {
    const m = await load({ zodVersion: 4 }, 'read');
    const { id: _id, ...withoutId } = row;
    expect(m.UserSchema.safeParse(withoutId).success).toBe(false); // passwordHash still required
    expect(
      m.UserSchema.safeParse({ ...withoutId, passwordHash: 'x' }).success,
    ).toBe(true);
    expect(m.UserReadSchema.safeParse(withoutId).success).toBe(false);
    const parsed = m.UserReadSchema.parse({ ...row, passwordHash: 'leak' });
    expect('passwordHash' in parsed).toBe(false);
  });

  it('nests Read schemas in the deep family, hidden fields stay out', async () => {
    const m = await load({ zodVersion: 4 }, 'read-deep');
    const parsed = m.PostReadDeepSchema.parse({
      id: row.id,
      title: 't',
      authorId: row.id,
      author: { ...row, passwordHash: 'leak' },
    });
    expect('passwordHash' in parsed.author).toBe(false);
  });
});
