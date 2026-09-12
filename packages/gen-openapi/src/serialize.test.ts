import { describe, expect, it } from 'vitest';
import { serialize } from './serialize.js';

const document = {
  openapi: '3.1.0',
  info: { title: 'blog', version: '0.0.0' },
  paths: {},
  components: { schemas: { User: { type: 'object', properties: {} } } },
};

describe('serialize', () => {
  it('formats json with a trailing newline', () => {
    const out = serialize(document, 'json');
    expect(out.endsWith('\n')).toBe(true);
    expect(JSON.parse(out)).toEqual(document);
  });

  it('formats yaml', () => {
    const out = serialize(document, 'yaml');
    expect(out).toContain('openapi: 3.1.0');
    expect(out).toContain('title: blog');
  });
});
