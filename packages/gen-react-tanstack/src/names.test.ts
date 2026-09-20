import { describe, expect, it } from 'vitest';
import {
  apiTypeName,
  barrelModule,
  defaultValuesName,
  entityModule,
  hookName,
  optionsTypeName,
  runtimeModule,
  variantToken,
} from './names.js';

describe('names', () => {
  it('variantToken: full has no token', () => {
    expect(variantToken('full')).toBe('');
    expect(variantToken('create')).toBe('Create');
    expect(variantToken('update')).toBe('Update');
  });

  it('identifiers per variant', () => {
    expect(hookName('LoginDto', 'full')).toBe('useLoginDtoForm');
    expect(hookName('LoginDto', 'create')).toBe('useLoginDtoCreateForm');
    expect(optionsTypeName('LoginDto', 'full')).toBe('UseLoginDtoFormOptions');
    expect(optionsTypeName('LoginDto', 'update')).toBe(
      'UseLoginDtoUpdateFormOptions',
    );
    expect(apiTypeName('LoginDto', 'full')).toBe('LoginDtoFormApi');
    expect(apiTypeName('LoginDto', 'create')).toBe('LoginDtoCreateFormApi');
    expect(defaultValuesName('LoginDto', 'full')).toBe(
      'defaultLoginDtoFormValues',
    );
    expect(defaultValuesName('LoginDto', 'update')).toBe(
      'defaultLoginDtoUpdateFormValues',
    );
  });

  it('identifiers are never namespace-prefixed', () => {
    expect(hookName('User', 'full')).not.toContain('blog');
  });

  it('module specifiers live under <ns>/react-tanstack', () => {
    expect(entityModule('api', 'LoginDto')).toBe(
      'api/react-tanstack/LoginDto.form',
    );
    expect(runtimeModule('api')).toBe('api/react-tanstack/form.runtime');
    expect(barrelModule('api')).toBe('api/react-tanstack');
  });
});
