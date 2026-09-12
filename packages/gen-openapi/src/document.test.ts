import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { buildDocument } from './document.js';
import { OpenApiGenInvalidSchemaNameError } from './errors.js';
import { blogSource, geoSource } from './testing/ir.js';

const baseOptions = {
  openapiVersion: '3.1' as const,
  format: 'json' as const,
  version: '0.0.0',
};

describe('buildDocument — envelope', () => {
  it('pins the 3.1 patch version and defaults title to the namespace', () => {
    const doc = buildDocument(blogSource(), baseOptions, 'blog');
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info).toEqual({ title: 'blog', version: '0.0.0' });
    expect(doc.paths).toEqual({});
  });

  it('pins the 3.0 patch version', () => {
    const doc = buildDocument(
      blogSource(),
      { ...baseOptions, openapiVersion: '3.0' },
      'blog',
    );
    expect(doc.openapi).toBe('3.0.3');
  });

  it('uses an explicit title over the namespace', () => {
    const doc = buildDocument(
      blogSource(),
      { ...baseOptions, title: 'Blog API' },
      'blog',
    );
    expect(doc.info.title).toBe('Blog API');
  });

  it('lists entities and type aliases sorted by name', () => {
    const doc = buildDocument(geoSource(), baseOptions, 'geo');
    expect(Object.keys(doc.components.schemas)).toEqual([
      'Circle',
      'Group',
      'Scalar',
      'Shape',
    ]);
  });

  it('emits one schema per entity plus a schema for each enum', () => {
    const doc = buildDocument(blogSource(), baseOptions, 'blog');
    expect(Object.keys(doc.components.schemas)).toEqual([
      'Post',
      'Role',
      'User',
    ]);
    expect(doc.components.schemas.User).toMatchObject({ type: 'object' });
    expect(doc.components.schemas.Role).toEqual({
      type: 'string',
      enum: ['ADMIN', 'USER'],
    });
  });
});

describe('buildDocument — invalid schema names', () => {
  it('throws OpenApiGenInvalidSchemaNameError for a name outside the OpenAPI key pattern', () => {
    const source = createSourceIR({ namespace: 'ns', parser: 'test' })
      .addEntity('Weird Name', (e) => {
        e.field('id', (f) => f.scalar('int').primary());
      })
      .build();
    expect(() => buildDocument(source, baseOptions, 'ns')).toThrow(
      OpenApiGenInvalidSchemaNameError,
    );
  });
});
