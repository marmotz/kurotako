import type { Generator, ResolvedConfig } from '@kurotako/core';
import { run } from '@kurotako/core';
import { zodGenerator } from '@kurotako/gen-zod';
import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { angularGenerator } from './generator.js';
import {
  fakeZodArtifact,
  fileEndingWith,
  runGenerator,
} from './testing/helpers.js';
import { blogSource, irOf, unionSource } from './testing/ir.js';

describe('angularGenerator.generate', () => {
  it('emits the runtime file, one file per entity and index.ts, all angular/-prefixed', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive', 'signal'],
      relations: 'flat',
      zodVersion: 4,
    });
    expect(out.files.map((f) => f.path)).toEqual([
      'blog/angular/zod-forms.runtime.ts',
      'blog/angular/User.form.ts',
      'blog/angular/Post.form.ts',
      'blog/angular/index.ts',
    ]);
  });

  it('forms: [] -> no runtime file emitted', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: [],
      relations: 'flat',
      zodVersion: 4,
    });
    expect(out.files.some((f) => f.path.endsWith('zod-forms.runtime.ts'))).toBe(
      false,
    );
  });

  it('forms: [reactive] -> the User file has no @angular/forms/signals import and no schema<...>', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).not.toContain('@angular/forms/signals');
    expect(user).not.toContain('schema<');
    expect(user).toContain('@Injectable');
    expect(user).toContain('FormGroup');
  });

  it('forms: [signal] -> the User file has no @Injectable and no FormGroup', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['signal'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).not.toContain('@Injectable');
    expect(user).not.toContain('FormGroup');
    expect(user).toContain('schema<');
  });

  it('forms: [signal] -> emits a create<Entity><Variant>Form wrapper around form(signal(model), schema)', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['signal'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).toContain(
      "import { form, schema } from '@angular/forms/signals';",
    );
    expect(user).toContain("import { signal } from '@angular/core';");
    expect(user).toContain(
      'export function createUserCreateForm(init?: Partial<UserCreateDto>): FieldTree<UserCreateDto> {\n  return form(signal(createUserCreateModel(init)), userCreateFormSchema);\n}',
    );
  });

  it('relations: flat -> relation names produce no control; FK scalar control present', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const post = fileEndingWith(out.files, 'Post.form.ts');
    expect(post).not.toContain('author:');
    expect(post).toContain('authorId: FormControl<string>');
  });

  it('relations: deep -> nested FormGroup for one (eager), FormArray for many (add<Relation><Variant>() emitted)', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'deep',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    const post = fileEndingWith(out.files, 'Post.form.ts');
    expect(user).toContain('FormArray<FormGroup<PostCreateDeepFormControls>>');
    expect(user).toContain('addPostsCreate(');
    expect(user).toContain('addPostsUpdate(');
    expect(post).toContain('FormGroup<UserCreateDeepFormControls>');
    expect(post).toContain(
      'this.userFormFactory.createCreateForm(init?.author)',
    );
  });

  it('the group has exactly one validator: zodValidator(<variant>Schema)', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).toContain('validators: [zodValidator(UserCreateSchema)]');
    expect(user).toContain('validators: [zodValidator(UserUpdateSchema)]');
    expect(user).not.toContain('Validators.');
  });

  it('enum control type is the Zod union, imported from the enums module', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).toContain('role: FormControl<Role>');
    expect(user).toContain(
      "import type { Role } from 'blog/angular/zod/enums';",
    );
  });

  it('a required enum field with no literal default seeds a real member, never a bare undefined (would break FormControl<T> under nonNullable: true)', () => {
    const source = createSourceIR({ namespace: 'pg', parser: 'test' })
      .addEnum('Provider', (e) =>
        e.value('OpenAi').value('Anthropic').value('Google').value('Alibaba'),
      )
      .addEntity('AiModel', (t) => {
        t.field('id', (f) =>
          f.scalar('uuid').primary().default({ kind: 'expr', expr: 'uuid()' }),
        );
        t.field('provider', (f) => f.enum('Provider'));
      })
      .build();
    const ir = irOf(source);
    const zod = fakeZodArtifact(ir);
    const out = runGenerator(ir, zod, {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const aiModel = fileEndingWith(out.files, 'AiModel.form.ts');
    expect(aiModel).not.toContain('?? undefined');
    expect(aiModel).toContain('init?.provider ?? "OpenAi"');
    expect(aiModel).toContain('value.provider ?? "OpenAi"');
  });

  it('imports are sorted by module specifier, named imports sorted', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive', 'signal'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    const importLines = user.split('\n').filter((l) => l.startsWith('import '));
    const specs = importLines.map((l) => l.match(/from '([^']+)'/)?.[1]);
    const sorted = [...specs].sort((a, b) => (a ?? '').localeCompare(b ?? ''));
    expect(specs).toEqual(sorted);
  });

  it('barrel re-exports every emitted entity + runtime file', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const barrel = fileEndingWith(out.files, 'index.ts');
    expect(barrel).toContain("export * from './zod-forms.runtime.js';");
    expect(barrel).toContain("export * from './User.form.js';");
    expect(barrel).toContain("export * from './Post.form.js';");
  });

  it('is deterministic: same IR + artifact + options -> deep-equal GenOutput on a second call', () => {
    const ir = irOf(blogSource());
    const zod = fakeZodArtifact(ir);
    const a = runGenerator(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'deep',
      zodVersion: 4,
    });
    const b = runGenerator(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'deep',
      zodVersion: 4,
    });
    expect(a).toEqual(b);
  });

  describe('union type', () => {
    it('discriminated union field -> nested FormGroup keyed by discriminator value + runtime switch', () => {
      const ir = irOf(unionSource());
      const out = runGenerator(ir, fakeZodArtifact(ir), {
        forms: ['reactive'],
        relations: 'flat',
        zodVersion: 4,
      });
      const invoice = fileEndingWith(out.files, 'Invoice.form.ts');
      expect(invoice).toContain(
        'method: FormGroup<{ "kind": FormControl<"card" | "transfer">; "card": FormGroup<CardPaymentCreateFormControls>; "transfer": FormGroup<BankTransferCreateFormControls> }>',
      );
      expect(invoice).toContain('switchDiscriminatedGroup(g, "kind")');
      expect(invoice).toContain(
        "import { switchDiscriminatedGroup, zodValidator } from 'pay/angular/zod-forms.runtime';",
      );
      // sub-groups built via the injected target factories
      expect(invoice).toContain(
        'private readonly cardPaymentFormFactory: CardPaymentFormFactory',
      );
      expect(invoice).toContain(
        'this.cardPaymentFormFactory.createCreateForm()',
      );
    });

    it('non-discriminated union field -> free FormControl<A | B> + logger.warn', () => {
      const ir = irOf(unionSource());
      const warnings: string[] = [];
      const out = runGenerator(
        ir,
        fakeZodArtifact(ir),
        { forms: ['reactive'], relations: 'flat', zodVersion: 4 },
        { debug() {}, info() {}, warn: (m) => warnings.push(m), error() {} },
      );
      const invoice = fileEndingWith(out.files, 'Invoice.form.ts');
      expect(invoice).toContain('ref: FormControl<string | number | null>');
      expect(invoice).toContain(
        '/* union: validated by zodValidator(schema) */',
      );
      expect(
        warnings.some((w) => w.includes("union field 'Invoice.ref'")),
      ).toBe(true);
    });

    it('a recursive alias union branch -> FormControl<unknown> + warn', () => {
      const source = createSourceIR({ namespace: 'pg', parser: 'test' })
        .addTypeAlias('Node', (t) =>
          t.union((u) => u.scalar('string').ref('Node')),
        )
        .addEntity('Doc', (t) => {
          t.field('id', (f) =>
            f
              .scalar('uuid')
              .primary()
              .default({ kind: 'expr', expr: 'uuid()' }),
          );
          t.field('body', (f) =>
            f.union((u) => u.scalar('string').ref('Node')),
          );
        })
        .build();
      const ir = irOf(source);
      const warnings: string[] = [];
      const out = runGenerator(
        ir,
        fakeZodArtifact(ir),
        { forms: ['reactive'], relations: 'flat', zodVersion: 4 },
        { debug() {}, info() {}, warn: (m) => warnings.push(m), error() {} },
      );
      const doc = fileEndingWith(out.files, 'Doc.form.ts');
      expect(doc).toContain('body: FormControl<unknown>');
      expect(warnings.filter((w) => w.includes("'Doc.body'"))).toHaveLength(1);
      expect(warnings.some((w) => w.includes('recursive'))).toBe(true);
    });
  });

  it('preserves IR entity + field order', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
      zodVersion: 4,
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    const interfaceBody = user.slice(
      user.indexOf('export interface UserCreateFormControls'),
      user.indexOf('export type UserCreateForm'),
    );
    const order = ['email', 'name', 'age', 'role', 'createdAt'].map((n) =>
      interfaceBody.indexOf(`${n}:`),
    );
    expect(order).toEqual([...order].sort((x, y) => x - y));
  });
});

/**
 * End to end through core: what `@kurotako/config` does to a config entry
 * (curry the options, resolve the private `zod` descriptor) is reproduced by hand
 * so the test needs no config file.
 */
describe('angularGenerator with its private zod dependency', () => {
  const angularOptions = {
    forms: ['reactive' as const],
    relations: 'flat' as const,
    zodVersion: 4 as const,
  };
  const privateZod: Generator = {
    name: 'zod',
    generate: (ctx) => zodGenerator.generate(ctx, { zodVersion: 4 }),
  };
  const angular: Generator = {
    name: 'angular',
    dependsOn: [privateZod],
    generate: (ctx) => angularGenerator.generate(ctx, angularOptions),
  };

  function config(generators: ResolvedConfig['generators']): ResolvedConfig {
    return {
      rootDir: '/unused',
      sources: {
        blog: { parser: { name: 'fake', parse: () => blogSource() } },
      },
      generators,
      outputs: [{ dir: '/unused' }],
    };
  }

  /** Every `blog/angular/zod/...` specifier the angular files import. */
  function privateZodImports(files: { path: string; content: string }[]) {
    const specifiers = new Set<string>();
    for (const file of files) {
      if (
        !file.path.startsWith('blog/angular/') ||
        file.path.includes('/zod/')
      ) {
        continue;
      }
      for (const m of file.content.matchAll(/from '(blog\/[^']+)'/g)) {
        // Skip angular's own files (`blog/angular/zod-forms.runtime`, ...).
        if (m[1] && !/^blog\/angular\/(?!zod\/)/.test(m[1]))
          specifiers.add(m[1]);
      }
    }
    return [...specifiers];
  }

  it('with no zod entry, emits the Zod tree under <ns>/angular/zod/ and only imports from it', async () => {
    const result = await run(config({ angular: { generator: angular } }), {
      write: false,
    });
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('blog/angular/zod/User.schema.ts');
    expect(paths).toContain('blog/angular/zod/enums.ts');
    expect(paths).toContain('blog/angular/User.form.ts');
    expect(paths.some((p) => p.startsWith('blog/zod/'))).toBe(false);

    const specifiers = privateZodImports(result.files);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier.startsWith('blog/angular/zod/')).toBe(true);
      expect(
        paths.includes(`${specifier}.ts`) ||
          paths.includes(`${specifier}/index.ts`),
      ).toBe(true);
    }
    expect(result.artifacts.zod).toBeUndefined();
  });

  it('merges the private zod peer into the angular artifact', async () => {
    const result = await run(config({ angular: { generator: angular } }), {
      write: false,
    });
    expect(result.artifacts.angular?.peerDependencies).toMatchObject({
      zod: '^4',
      '@angular/core': expect.any(String),
    });
  });

  it('with an explicit zod entry, both trees coexist without collision', async () => {
    const userZod: Generator = {
      name: 'zod',
      generate: (ctx) => zodGenerator.generate(ctx, { zodVersion: 4 }),
    };
    const result = await run(
      config({
        zod: { generator: userZod },
        angular: { generator: angular },
      }),
      { write: false },
    );
    const paths = result.files.map((f) => f.path);
    expect(paths).toContain('blog/zod/User.schema.ts');
    expect(paths).toContain('blog/angular/zod/User.schema.ts');
    const barrel = result.files.find((f) => f.path === 'blog/index.ts');
    expect(barrel?.content).not.toContain('angular/zod');
  });
});
