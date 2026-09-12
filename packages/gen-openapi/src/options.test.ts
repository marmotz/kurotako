import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { OpenApiGeneratorOptions } from './options.js';

describe('OpenApiGeneratorOptions', () => {
  it('applies defaults', () => {
    expect(v.parse(OpenApiGeneratorOptions, {})).toEqual({
      openapiVersion: '3.1',
      format: 'json',
      version: '0.0.0',
    });
  });

  it('accepts openapiVersion 3.0', () => {
    expect(
      v.parse(OpenApiGeneratorOptions, { openapiVersion: '3.0' }),
    ).toMatchObject({ openapiVersion: '3.0' });
  });

  it('accepts format yaml', () => {
    expect(v.parse(OpenApiGeneratorOptions, { format: 'yaml' })).toMatchObject({
      format: 'yaml',
    });
  });

  it('accepts an explicit title and version', () => {
    expect(
      v.parse(OpenApiGeneratorOptions, { title: 'Blog API', version: '1.2.3' }),
    ).toMatchObject({ title: 'Blog API', version: '1.2.3' });
  });

  it('rejects an unknown openapiVersion', () => {
    expect(() =>
      v.parse(OpenApiGeneratorOptions, { openapiVersion: '2.0' }),
    ).toThrow();
  });

  it('rejects an unknown format', () => {
    expect(() => v.parse(OpenApiGeneratorOptions, { format: 'xml' })).toThrow();
  });
});
