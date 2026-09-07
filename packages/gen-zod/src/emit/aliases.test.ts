import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { geoSource } from '../testing/ir.js';
import { emitAliases } from './aliases.js';

describe('emitAliases', () => {
  const out = emitAliases(geoSource(), dialectFor(4));

  it('emits one type + annotated schema const per alias, sorted by name', () => {
    const order = ['Scalar', 'Shape'].map((n) =>
      out.indexOf(`export const ${n}Schema`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(out).toContain('/** a string or an int */');
    expect(out).toContain('export type Scalar = string | number;');
    expect(out).toContain('export const ScalarSchema: z.ZodType<Scalar> =');
  });

  it('renders a plain union as z.union', () => {
    expect(out).toContain(
      'export const ScalarSchema: z.ZodType<Scalar> = z.union([z.string(), z.int()]);',
    );
  });

  it('renders a discriminated union as z.discriminatedUnion, lazy over its refs', () => {
    expect(out).toContain('export type Shape = CircleDto | GroupDto;');
    expect(out).toContain(
      'export const ShapeSchema: z.ZodType<Shape> = z.discriminatedUnion("kind", [z.lazy(() => CircleSchema), z.lazy(() => GroupSchema)]);',
    );
  });

  it('imports referenced entity schemas + types, not sibling aliases', () => {
    expect(out).toContain(
      "import { CircleSchema, type CircleDto } from './Circle.schema';",
    );
    expect(out).toContain(
      "import { GroupSchema, type GroupDto } from './Group.schema';",
    );
    expect(out).not.toContain("from './Scalar'");
  });
});
