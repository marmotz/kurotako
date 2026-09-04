import { describe, expect, it } from 'vitest';
import { buildArtifact } from './artifact.js';
import { fakeZodArtifact } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';

describe('buildArtifact', () => {
  const ir = irOf(blogSource());
  const zod = fakeZodArtifact(ir, { zodVersion: 4 });

  it('entities are keyed namespace.entity, module is angular/-prefixed', () => {
    const artifact = buildArtifact(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'flat',
    });
    expect(Object.keys(artifact.entities)).toEqual(['blog.User', 'blog.Post']);
    expect(artifact.entities['blog.User']?.module).toBe(
      'blog/angular/User.form',
    );
  });

  it('every expected role is present for both surfaces', () => {
    const artifact = buildArtifact(ir, zod, {
      forms: ['reactive', 'signal'],
      relations: 'flat',
    });
    const symbols = artifact.entities['blog.User']?.symbols ?? {};
    expect(symbols).toMatchObject({
      createControls: 'UserCreateFormControls',
      createForm: 'UserCreateForm',
      updateControls: 'UserUpdateFormControls',
      updateForm: 'UserUpdateForm',
      factory: 'UserFormFactory',
      createSchema: 'userCreateFormSchema',
      updateSchema: 'userUpdateFormSchema',
      createModel: 'createUserCreateModel',
      updateModel: 'createUserUpdateModel',
      createSignalForm: 'createUserCreateForm',
      updateSignalForm: 'createUserUpdateForm',
    });
  });

  it('relations: deep also exposes the *Deep* role aliases', () => {
    const artifact = buildArtifact(ir, zod, {
      forms: ['reactive'],
      relations: 'deep',
    });
    const symbols = artifact.entities['blog.User']?.symbols ?? {};
    expect(symbols.createDeepControls).toBe('UserCreateDeepFormControls');
    expect(symbols.createControls).toBe('UserCreateDeepFormControls');
  });

  it('extra.forms / extra.relations echo the options; extra.zodVersion echoes the Zod artifact', () => {
    const artifact = buildArtifact(ir, zod, {
      forms: ['signal'],
      relations: 'deep',
    });
    expect(artifact.extra).toMatchObject({
      forms: ['signal'],
      relations: 'deep',
      zodVersion: 4,
    });
  });

  it('peerDependencies floor is >=22 when signal is emitted, >=17 otherwise', () => {
    const withSignal = buildArtifact(ir, zod, {
      forms: ['signal'],
      relations: 'flat',
    });
    expect(withSignal.peerDependencies).toEqual({
      '@angular/core': '>=22',
      '@angular/forms': '>=22',
    });

    const reactiveOnly = buildArtifact(ir, zod, {
      forms: ['reactive'],
      relations: 'flat',
    });
    expect(reactiveOnly.peerDependencies).toEqual({
      '@angular/core': '>=17',
      '@angular/forms': '>=17',
    });
  });

  it('perNamespace reports the angular/-prefixed runtime and barrel modules', () => {
    const artifact = buildArtifact(ir, zod, {
      forms: ['reactive'],
      relations: 'flat',
    });
    const extra = artifact.extra as { perNamespace: Record<string, unknown> };
    expect(extra.perNamespace.blog).toEqual({
      runtimeModule: 'blog/angular/zod-forms.runtime',
      barrelModule: 'blog/angular',
    });
  });
});
