import { createSourceIR } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { ZodEnumCollisionError } from '../errors.js';
import { blogSource } from '../testing/ir.js';
import { collectEnums, emitEnums } from './enums.js';

const d = dialectFor(4);

describe('emitEnums', () => {
  it('const array + z.enum + type per enum', () => {
    const out = emitEnums(blogSource(), d);
    expect(out).toContain('export const Role = ["ADMIN", "USER"] as const;');
    expect(out).toContain('export const RoleSchema = z.enum(Role);');
    expect(out).toContain('export type Role = (typeof Role)[number];');
    expect(out.startsWith("import { z } from 'zod';")).toBe(true);
  });

  it('emits entity-local enums, sorted by name', () => {
    const src = createSourceIR({ namespace: 'blog', parser: 'test' })
      .addEnum('Zeta', (e) => e.value('A'))
      .addEntity('Thing', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.field('status', (f) => f.enum('Alpha'));
        t.localEnum('Alpha', (e) => e.value('ON').value('OFF'));
      })
      .build();
    const out = emitEnums(src, d);
    expect(out.indexOf('const Alpha')).toBeLessThan(out.indexOf('const Zeta'));
  });

  it('two distinct defs sharing a name -> ZodEnumCollisionError', () => {
    const src = createSourceIR({ namespace: 'blog', parser: 'test' })
      .addEnum('Role', (e) => e.value('ADMIN').value('USER'))
      .addEntity('Thing', (t) => {
        t.field('id', (f) => f.scalar('int').primary());
        t.field('role', (f) => f.enum('Role'));
        t.localEnum('Role', (e) => e.value('X').value('Y'));
      })
      .build();
    expect(() => collectEnums(src)).toThrow(ZodEnumCollisionError);
  });
});
