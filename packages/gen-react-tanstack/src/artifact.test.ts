import { describe, expect, it } from 'vitest';
import { buildArtifact, TANSTACK_FORM_RANGE } from './artifact.js';
import { defaultOptions } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';

describe('buildArtifact', () => {
  const ir = irOf(blogSource());
  const emitted = new Map([['blog', ['User', 'Post']]]);

  it('full variant: hook / values / options / api / defaultValues symbols and the entity module', () => {
    const artifact = buildArtifact(ir, emitted, 4, defaultOptions);
    expect(artifact.entities['blog.User']).toEqual({
      module: 'blog/react-tanstack/User.form',
      symbols: {
        hook: 'useUserForm',
        values: 'UserFormValues',
        options: 'UseUserFormOptions',
        api: 'UserFormApi',
        defaultValues: 'defaultUserFormValues',
      },
    });
  });

  it('create / update variants get a create* / update* symbol family', () => {
    const artifact = buildArtifact(ir, emitted, 4, {
      ...defaultOptions,
      variants: ['create', 'update'],
    });
    expect(artifact.entities['blog.Post']?.symbols).toEqual({
      createHook: 'usePostCreateForm',
      createValues: 'PostCreateFormValues',
      createOptions: 'UsePostCreateFormOptions',
      createApi: 'PostCreateFormApi',
      createDefaultValues: 'defaultPostCreateFormValues',
      updateHook: 'usePostUpdateForm',
      updateValues: 'PostUpdateFormValues',
      updateOptions: 'UsePostUpdateFormOptions',
      updateApi: 'PostUpdateFormApi',
      updateDefaultValues: 'defaultPostUpdateFormValues',
    });
  });

  it('only lists emitted entities', () => {
    const artifact = buildArtifact(
      ir,
      new Map([['blog', ['Post']]]),
      4,
      defaultOptions,
    );
    expect(Object.keys(artifact.entities)).toEqual(['blog.Post']);
  });

  it('declares the @tanstack/react-form peer dependency', () => {
    const artifact = buildArtifact(ir, emitted, 4, defaultOptions);
    expect(artifact.peerDependencies).toEqual({
      '@tanstack/react-form': TANSTACK_FORM_RANGE,
    });
  });

  it('extra echoes variants, relations, the Zod version and per-namespace modules', () => {
    const artifact = buildArtifact(ir, emitted, 3, {
      ...defaultOptions,
      relations: 'deep',
    });
    expect(artifact.extra).toEqual({
      variants: ['full'],
      relations: 'deep',
      zodVersion: 3,
      perNamespace: {
        blog: {
          runtimeModule: 'blog/react-tanstack/form.runtime',
          barrelModule: 'blog/react-tanstack',
        },
      },
    });
  });
});
