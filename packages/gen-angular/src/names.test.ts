import { describe, expect, it } from 'vitest';
import {
  barrelModule,
  controlsTypeName,
  entityModule,
  factoryMethod,
  factoryName,
  formTypeName,
  modelFactoryName,
  relationBuilderMethod,
  runtimeModule,
  signalSchemaName,
} from './names.js';

describe('names', () => {
  it('controlsTypeName: variant x family matrix', () => {
    expect(controlsTypeName('User', 'Create')).toBe('UserCreateFormControls');
    expect(controlsTypeName('User', 'Update')).toBe('UserUpdateFormControls');
    expect(controlsTypeName('User', 'Create', 'Deep')).toBe(
      'UserCreateDeepFormControls',
    );
    expect(controlsTypeName('User', 'Update', 'Deep')).toBe(
      'UserUpdateDeepFormControls',
    );
  });

  it('formTypeName mirrors controlsTypeName', () => {
    expect(formTypeName('User', 'Create')).toBe('UserCreateForm');
    expect(formTypeName('User', 'Create', 'Deep')).toBe('UserCreateDeepForm');
  });

  it('factoryName / factoryMethod: no suffix for the deep family', () => {
    expect(factoryName('User')).toBe('UserFormFactory');
    expect(factoryMethod('Create')).toBe('createCreateForm');
    expect(factoryMethod('Update')).toBe('createUpdateForm');
  });

  it('relationBuilderMethod capitalizes the relation name and suffixes the variant', () => {
    expect(relationBuilderMethod('posts', 'Create')).toBe('addPostsCreate');
    expect(relationBuilderMethod('author', 'Update')).toBe('addAuthorUpdate');
  });

  it('signalSchemaName is camelCase', () => {
    expect(signalSchemaName('User', 'Create')).toBe('userCreateFormSchema');
    expect(signalSchemaName('User', 'Update')).toBe('userUpdateFormSchema');
  });

  it('modelFactoryName', () => {
    expect(modelFactoryName('User', 'Create')).toBe('createUserCreateModel');
    expect(modelFactoryName('User', 'Update')).toBe('createUserUpdateModel');
  });

  it('module specifiers are angular/-prefixed', () => {
    expect(entityModule('blog', 'User')).toBe('blog/angular/User.form');
    expect(runtimeModule('blog')).toBe('blog/angular/zod-forms.runtime');
    expect(barrelModule('blog')).toBe('blog/angular');
  });
});
