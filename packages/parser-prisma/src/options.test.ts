import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { PrismaParserOptions } from './options.js';

describe('PrismaParserOptions', () => {
  it('defaults schema to ./prisma/schema.prisma', () => {
    const parsed = v.parse(PrismaParserOptions, {});
    expect(parsed.schema).toBe('./prisma/schema.prisma');
    expect(parsed.version).toBeUndefined();
  });

  it('keeps an explicit schema path and version', () => {
    const parsed = v.parse(PrismaParserOptions, {
      schema: './db/schema.prisma',
      version: 7,
    });
    expect(parsed).toEqual({ schema: './db/schema.prisma', version: 7 });
  });

  it('rejects a version outside the picklist', () => {
    expect(() => v.parse(PrismaParserOptions, { version: 6 })).toThrow();
  });

  it('rejects an unknown key', () => {
    expect(() =>
      v.parse(PrismaParserOptions, { schemaPath: './x.prisma' }),
    ).toThrow();
  });
});
