import type { Generator, ResolvedConfig } from '@kurotako/core';
import { run } from '@kurotako/core';
import { zodGenerator } from '@kurotako/gen-zod';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import {
  MissingZodDependencyError,
  UnknownIncludeEntityError,
} from './errors.js';
import { reactTanstackGenerator } from './generator.js';
import {
  fakeZodArtifact,
  fileEndingWith,
  noopLogger,
  runGenerator,
} from './testing/helpers.js';
import { apiSource, blogSource, irOf, shopSource } from './testing/ir.js';

describe('reactTanstackGenerator.generate', () => {
  it('emits the runtime file, one file per entity and index.ts, all react-tanstack/-prefixed', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir));
    expect(out.files.map((f) => f.path)).toEqual([
      'blog/react-tanstack/form.runtime.ts',
      'blog/react-tanstack/User.form.ts',
      'blog/react-tanstack/Post.form.ts',
      'blog/react-tanstack/index.ts',
    ]);
  });

  it('flat full variant: golden hook file for a request-body entity', () => {
    const ir = irOf(apiSource());
    const out = runGenerator(ir, fakeZodArtifact(ir));
    expect(
      fileEndingWith(out.files, 'LoginDto.form.ts'),
    ).toBe(`import { useZodForm } from 'api/react-tanstack/form.runtime';
import type { ZodFormApi, ZodFormConfig, ZodFormSchema } from 'api/react-tanstack/form.runtime';
import { LoginDtoSchema } from 'api/react-tanstack/zod/LoginDto.schema';
import type { LoginDtoDto } from 'api/react-tanstack/zod/LoginDto.schema';

export type LoginDtoFormValues = LoginDtoDto;

export function defaultLoginDtoFormValues(init?: Partial<LoginDtoFormValues>): LoginDtoFormValues {
  return {
    email: init?.email ?? '',
    password: init?.password ?? '',
  };
}

export type LoginDtoFormApi = ZodFormApi<LoginDtoFormValues>;

export interface UseLoginDtoFormOptions
  extends Omit<ZodFormConfig<LoginDtoFormValues>, 'defaultValues' | 'schema'> {
  defaultValues?: Partial<LoginDtoFormValues>;
  /** Replaces the generated schema, e.g. a refined or extended one built at runtime. */
  schema?: ZodFormSchema<LoginDtoFormValues>;
}

export function useLoginDtoForm(options: UseLoginDtoFormOptions = {}): LoginDtoFormApi {
  const { defaultValues, schema, ...rest } = options;
  return useZodForm<LoginDtoFormValues>({
    ...rest,
    defaultValues: defaultLoginDtoFormValues(defaultValues),
    schema: schema ?? LoginDtoSchema,
  });
}
`);
  });

  it('seeds every field kind: literal, expr, enum, nullable, list, date', () => {
    const ir = irOf(blogSource());
    const user = fileEndingWith(
      runGenerator(ir, fakeZodArtifact(ir)).files,
      'User.form.ts',
    );
    expect(user).toContain("id: init?.id ?? '',");
    expect(user).toContain('age: init?.age ?? 0,');
    expect(user).toContain('role: init?.role ?? "USER",');
    // No literal default: the enum's first member.
    expect(user).toContain('nickname: init?.nickname ?? "ADMIN",');
    expect(user).toContain('createdAt: init?.createdAt ?? new Date(0),');
    expect(user).toContain('archivedAt: init?.archivedAt ?? null,');
    expect(user).toContain('tags: init?.tags ?? [],');
    const post = fileEndingWith(
      runGenerator(ir, fakeZodArtifact(ir)).files,
      'Post.form.ts',
    );
    expect(post).toContain('published: init?.published ?? false,');
  });

  it('ref / union / json fields are seeded undefined, cast to the DTO field type', () => {
    const ir = irOf(shopSource());
    const product = fileEndingWith(
      runGenerator(ir, fakeZodArtifact(ir)).files,
      'Product.form.ts',
    );
    expect(product).toContain(
      'note: (init?.note ?? undefined) as ProductFormValues["note"],',
    );
    expect(product).toContain(
      'meta: (init?.meta ?? undefined) as ProductFormValues["meta"],',
    );
    const category = fileEndingWith(
      runGenerator(ir, fakeZodArtifact(ir)).files,
      'Category.form.ts',
    );
    // A field reaching a ref cycle is typed `unknown` and left unseeded.
    expect(category).toContain(
      'export type CategoryFormValues = Omit<CategoryDto, "parent"> & { parent?: unknown };',
    );
    expect(category).not.toContain('parent:');
  });

  describe('variants', () => {
    const ir = irOf(blogSource());

    it('create / update hooks use the create / update Zod roles and field sets', () => {
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        variants: ['create', 'update'],
      });
      const user = fileEndingWith(out.files, 'User.form.ts');
      expect(user).toContain(
        "import { UserCreateSchema, UserUpdateSchema } from 'blog/react-tanstack/zod/User.schema';",
      );
      expect(user).toContain('export function useUserCreateForm(');
      expect(user).toContain('export function useUserUpdateForm(');
      expect(user).not.toContain('export function useUserForm(');
      const createBody = user.slice(
        user.indexOf('export function defaultUserCreateFormValues'),
        user.indexOf('export type UserCreateFormApi'),
      );
      // The db-assigned primary key is not part of the create payload.
      expect(createBody).not.toContain('id:');
      expect(createBody).toContain('email:');
      const updateBody = user.slice(
        user.indexOf('export function defaultUserUpdateFormValues'),
        user.indexOf('export type UserUpdateFormApi'),
      );
      expect(updateBody).not.toContain('id:');
    });

    it('all three variants in one file, in the declared order', () => {
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        variants: ['full', 'create', 'update'],
      });
      const user = fileEndingWith(out.files, 'User.form.ts');
      const order = [
        'export function useUserForm(',
        'export function useUserCreateForm(',
        'export function useUserUpdateForm(',
      ].map((s) => user.indexOf(s));
      expect(order.every((i) => i >= 0)).toBe(true);
      expect(order).toEqual([...order].sort((a, b) => a - b));
    });
  });

  describe('include', () => {
    it('restricts the emitted entities in every covered namespace', () => {
      const ir = irOf(apiSource(), blogSource());
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        include: ['LoginDto', 'Post'],
      });
      expect(out.files.map((f) => f.path)).toEqual([
        'api/react-tanstack/form.runtime.ts',
        'api/react-tanstack/LoginDto.form.ts',
        'api/react-tanstack/index.ts',
        'blog/react-tanstack/form.runtime.ts',
        'blog/react-tanstack/Post.form.ts',
        'blog/react-tanstack/index.ts',
      ]);
      expect(Object.keys(out.artifact?.entities ?? {})).toEqual([
        'api.LoginDto',
        'blog.Post',
      ]);
    });

    it('a namespace with no included entity emits only an empty index.ts and no runtime', () => {
      const ir = irOf(apiSource(), blogSource());
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        include: ['LoginDto'],
      });
      expect(out.files.map((f) => f.path)).toContain(
        'blog/react-tanstack/index.ts',
      );
      expect(fileEndingWith(out.files, 'blog/react-tanstack/index.ts')).toBe(
        'export {};\n',
      );
      expect(
        out.files.some((f) => f.path === 'blog/react-tanstack/form.runtime.ts'),
      ).toBe(false);
    });

    it('a name found in no covered namespace throws UnknownIncludeEntityError', () => {
      const ir = irOf(apiSource());
      expect(() =>
        runGenerator(ir, fakeZodArtifact(ir), {
          include: ['LoginDto', 'LogInDto'],
        }),
      ).toThrow(UnknownIncludeEntityError);
    });
  });

  it('a missing private zod dependency throws MissingZodDependencyError', () => {
    const ir = irOf(apiSource());
    expect(() =>
      reactTanstackGenerator.generate(
        {
          ir,
          dependencies: {},
          cycles: new Set(),
          segment: 'react-tanstack',
          logger: noopLogger,
        },
        { zodVersion: 4, variants: ['full'], relations: 'flat' },
      ),
    ).toThrow(MissingZodDependencyError);
  });

  it('the artifact echoes the consumed Zod version', () => {
    const ir = irOf(apiSource());
    const out = runGenerator(ir, fakeZodArtifact(ir, { zodVersion: 3 }));
    expect(out.artifact?.extra).toMatchObject({ zodVersion: 3 });
  });

  it('is deterministic: two runs are deep-equal', () => {
    const ir = irOf(blogSource(), shopSource());
    const options = {
      variants: ['full', 'create', 'update'] as const,
      relations: 'deep' as const,
    };
    const a = runGenerator(ir, fakeZodArtifact(ir), {
      ...options,
      variants: [...options.variants],
    });
    const b = runGenerator(ir, fakeZodArtifact(ir), {
      ...options,
      variants: [...options.variants],
    });
    expect(b).toEqual(a);
  });

  it('every emitted file ends with exactly one newline', () => {
    const ir = irOf(blogSource());
    for (const file of runGenerator(ir, fakeZodArtifact(ir), {
      variants: ['full', 'create', 'update'],
    }).files) {
      expect(file.content.endsWith('\n')).toBe(true);
      expect(file.content.endsWith('\n\n')).toBe(false);
    }
  });

  describe("relations: 'deep'", () => {
    const deep = { relations: 'deep' as const };

    it('types the values with the deep Zod roles', () => {
      const ir = irOf(blogSource());
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        ...deep,
        variants: ['full', 'create', 'update'],
      });
      const post = fileEndingWith(out.files, 'Post.form.ts');
      expect(post).toContain('PostDeepDto');
      expect(post).toContain('PostCreateDeepDto');
      expect(post).toContain('PostUpdateDeepDto');
      expect(post).toContain('schema: schema ?? PostDeepSchema,');
      expect(post).toContain('schema: schema ?? PostCreateDeepSchema,');
      expect(post).toContain('schema: schema ?? PostUpdateDeepSchema,');
    });

    it("a to-one relation defaults to the target's own default-values function", () => {
      const ir = irOf(blogSource());
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        ...deep,
        variants: ['create'],
      });
      const post = fileEndingWith(out.files, 'Post.form.ts');
      expect(post).toContain(
        "import { defaultUserCreateFormValues } from 'blog/react-tanstack/User.form';",
      );
      expect(post).toContain(
        'author: defaultUserCreateFormValues(init?.author),',
      );
    });

    it('a to-many relation defaults to an empty array, without importing the target', () => {
      const ir = irOf(blogSource());
      const user = fileEndingWith(
        runGenerator(ir, fakeZodArtifact(ir), deep).files,
        'User.form.ts',
      );
      expect(user).toContain('posts: init?.posts ?? [],');
      expect(user).not.toContain('Post.form');
    });

    it('each variant nests the target default of the same variant', () => {
      const ir = irOf(blogSource());
      const post = fileEndingWith(
        runGenerator(ir, fakeZodArtifact(ir), {
          ...deep,
          variants: ['full', 'update'],
        }).files,
        'Post.form.ts',
      );
      expect(post).toContain('author: defaultUserFormValues(init?.author),');
      expect(post).toContain(
        'author: defaultUserUpdateFormValues(init?.author),',
      );
    });

    it('a to-one relation whose target is in a ref cycle degrades, with a debug log', () => {
      const ir = irOf(shopSource());
      const debugs: string[] = [];
      const out = runGenerator(ir, fakeZodArtifact(ir), deep, {
        ...noopLogger,
        debug: (m: string) => debugs.push(m),
      });
      const product = fileEndingWith(out.files, 'Product.form.ts');
      expect(product).toContain(
        'category: (init?.category ?? undefined) as ProductFormValues["category"],',
      );
      expect(product).not.toContain('Category.form');
      expect(
        debugs.some(
          (m) => m.includes("'category'") && m.includes('recurses back'),
        ),
      ).toBe(true);
      // The acyclic to-one target is still nested.
      expect(product).toContain('brand: defaultBrandFormValues(init?.brand),');
    });

    it('a to-one relation pair that recurses forever is not seeded (no infinite default)', () => {
      const source = createSourceIR({ namespace: 'p', parser: 'test' })
        .addEntity('Person', (t) => {
          t.field('name', (f) => f.scalar('string'));
          t.relation('passport', (r) => r.to('p', 'Passport').one());
        })
        .addEntity('Passport', (t) => {
          t.field('number', (f) => f.scalar('string'));
          t.relation('holder', (r) => r.to('p', 'Person').one());
        })
        .build();
      const ir = irOf(source);
      const out = runGenerator(ir, fakeZodArtifact(ir), deep);
      const person = fileEndingWith(out.files, 'Person.form.ts');
      expect(person).toContain(
        'passport: (init?.passport ?? undefined) as PersonFormValues["passport"],',
      );
      expect(person).not.toContain('defaultPassportFormValues');
      // The relation back to the root is left out of the values type.
      const passport = fileEndingWith(out.files, 'Passport.form.ts');
      expect(passport).toContain(
        'export type PassportFormValues = Omit<PassportDeepDto, "holder"> & { holder: Omit<PersonDeepDto, "passport"> };',
      );
    });

    it('a cross-source relation is left out (flat FK scalar only), with a debug log', () => {
      const ir = irOf(shopSource());
      const debugs: string[] = [];
      const out = runGenerator(ir, fakeZodArtifact(ir), deep, {
        ...noopLogger,
        debug: (m: string) => debugs.push(m),
      });
      const product = fileEndingWith(out.files, 'Product.form.ts');
      expect(product).not.toContain('owner');
      expect(
        debugs.some((m) => m.includes("'owner'") && m.includes('other.Owner')),
      ).toBe(true);
    });

    it('a to-one target excluded by include degrades instead of importing a missing module', () => {
      const ir = irOf(blogSource());
      const debugs: string[] = [];
      const out = runGenerator(
        ir,
        fakeZodArtifact(ir),
        { ...deep, include: ['Post'] },
        { ...noopLogger, debug: (m: string) => debugs.push(m) },
      );
      const post = fileEndingWith(out.files, 'Post.form.ts');
      expect(post).toContain(
        'author: (init?.author ?? undefined) as PostFormValues["author"],',
      );
      expect(post).not.toContain('User.form');
      expect(debugs.some((m) => m.includes('not emitted'))).toBe(true);
    });

    it('flat mode never mentions relations', () => {
      const ir = irOf(blogSource());
      const post = fileEndingWith(
        runGenerator(ir, fakeZodArtifact(ir)).files,
        'Post.form.ts',
      );
      expect(post).not.toContain('author:');
      expect(post).not.toContain('User.form');
    });
  });

  it('an entity with no field in a variant still yields a valid default-values function', () => {
    const source = createSourceIR({ namespace: 'x', parser: 'test' })
      .addEntity('OnlyId', (t) => {
        t.field('id', (f) =>
          f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
        );
      })
      .build();
    const ir = irOf(source);
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      variants: ['create'],
    });
    expect(fileEndingWith(out.files, 'OnlyId.form.ts')).toContain('return {};');
  });
});

/**
 * Wiring through core's real pipeline: `@kurotako/config`'s `dependsOn` resolution
 * (curry the options, resolve the private `zod` descriptor) is reproduced by hand
 * so the test needs no config file.
 */
describe('reactTanstackGenerator with its private zod dependency', () => {
  const privateZod = (zodVersion: 3 | 4): Generator => ({
    name: 'zod',
    generate: (ctx) => zodGenerator.generate(ctx, { zodVersion }),
  });
  const reactTanstack = (zodVersion: 3 | 4): Generator => ({
    name: 'react-tanstack',
    dependsOn: [privateZod(zodVersion)],
    generate: (ctx) =>
      reactTanstackGenerator.generate(ctx, {
        zodVersion,
        variants: ['full'],
        relations: 'flat',
      }),
  });

  function config(generators: ResolvedConfig['generators']): ResolvedConfig {
    return {
      rootDir: '/unused',
      sources: {
        api: { parser: { name: 'fake', parse: () => apiSource() } },
      },
      generators,
      outputs: [{ dir: '/unused' }],
    };
  }

  it('with no zod entry, emits the Zod tree under <ns>/react-tanstack/zod/ and only imports from it', async () => {
    const result = await run(
      config({ 'react-tanstack': { generator: reactTanstack(4) } }),
      { write: false },
    );
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('api/react-tanstack/zod/LoginDto.schema.ts');
    expect(paths).toContain('api/react-tanstack/LoginDto.form.ts');
    expect(paths.some((p) => p.startsWith('api/zod/'))).toBe(false);

    const form = result.files.find(
      (f) => f.path === 'api/react-tanstack/LoginDto.form.ts',
    );
    expect(form?.content).toContain(
      "from 'api/react-tanstack/zod/LoginDto.schema'",
    );
    expect(result.artifacts.zod).toBeUndefined();
  });

  it('merges the private zod peer into the react-tanstack artifact', async () => {
    const result = await run(
      config({ 'react-tanstack': { generator: reactTanstack(4) } }),
      { write: false },
    );
    expect(result.artifacts['react-tanstack']?.peerDependencies).toMatchObject({
      zod: '^4',
      '@tanstack/react-form': expect.any(String),
    });
  });

  it('a non-default zodVersion reaches the private Zod copy', async () => {
    const result = await run(
      config({ 'react-tanstack': { generator: reactTanstack(3) } }),
      { write: false },
    );
    expect(result.artifacts['react-tanstack']?.peerDependencies).toMatchObject({
      zod: '^3',
    });
    expect(result.artifacts['react-tanstack']?.extra).toMatchObject({
      zodVersion: 3,
    });
  });
});
