import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import {
  fakeZodArtifact,
  fileEndingWith,
  runGenerator,
} from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';

describe('angularGenerator.generate', () => {
  it('emits the runtime file, one file per entity and index.ts, all angular/-prefixed', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive', 'signal'],
      relations: 'flat',
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
    });
    const user = fileEndingWith(out.files, 'User.form.ts');
    expect(user).toContain('role: FormControl<Role>');
    expect(user).toContain("import type { Role } from 'blog/zod/enums';");
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
    });
    const barrel = fileEndingWith(out.files, 'index.ts');
    expect(barrel).toContain("export * from './zod-forms.runtime';");
    expect(barrel).toContain("export * from './User.form';");
    expect(barrel).toContain("export * from './Post.form';");
  });

  it('is deterministic: same IR + artifact + options -> deep-equal GenOutput on a second call', () => {
    const ir = irOf(blogSource());
    const zod = fakeZodArtifact(ir);
    const a = runGenerator(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'deep',
    });
    const b = runGenerator(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'deep',
    });
    expect(a).toEqual(b);
  });

  it('preserves IR entity + field order', () => {
    const ir = irOf(blogSource());
    const out = runGenerator(ir, fakeZodArtifact(ir), {
      forms: ['reactive'],
      relations: 'flat',
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
