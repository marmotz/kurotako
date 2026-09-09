import { describe, expect, it } from 'vitest';
import { buildArtifact } from './artifact.js';
import { blogSource, irOf } from './testing/ir.js';

describe('buildArtifact', () => {
  it('publishes the complete entity symbol matrix and namespace metadata', () => {
    const artifact = buildArtifact(irOf(blogSource()));
    expect(artifact.entities['blog.User']).toEqual({
      module: 'blog/typescript/User.type',
      symbols: {
        type: 'UserDto',
        deepType: 'UserDeepDto',
        createType: 'UserCreateDto',
        createDeepType: 'UserCreateDeepDto',
        updateType: 'UserUpdateDto',
        updateDeepType: 'UserUpdateDeepDto',
        whereType: 'UserWhereDto',
        whereDeepType: 'UserWhereDeepDto',
        selectType: 'UserSelectDto',
        selectDeepType: 'UserSelectDeepDto',
      },
    });
    expect(artifact.peerDependencies).toBeUndefined();
    expect(artifact.extra).toEqual({
      families: ['flat', 'deep'],
      variants: ['full', 'create', 'update', 'where', 'select'],
      perNamespace: {
        blog: {
          barrelModule: 'blog/typescript',
          filtersModule: 'blog/typescript/filters',
          scalarsModule: 'blog/typescript/scalars',
          enums: {
            Role: {
              constName: 'Role',
              typeName: 'Role',
              module: 'blog/typescript/enums',
            },
          },
        },
      },
    });
  });
});
