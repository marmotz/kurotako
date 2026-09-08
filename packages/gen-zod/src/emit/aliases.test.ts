import { refCycleMembers } from '@kurotako/ir';
import { describe, expect, it } from 'vitest';
import { dialectFor } from '../dialect.js';
import { geoSource } from '../testing/ir.js';
import { emitAliases } from './aliases.js';

describe('emitAliases', () => {
  const source = geoSource();
  const cyclicRefs = refCycleMembers(source);
  const out = emitAliases(source, dialectFor(4), cyclicRefs);

  it('a non-cyclic alias re-uses z.infer, a cyclic one is hand-typed + annotated', () => {
    expect(out).toContain('/** a string or an int */');
    expect(out).toContain(
      'export const ScalarSchema = z.union([z.string(), z.int()]);',
    );
    expect(out).toContain('export type Scalar = z.infer<typeof ScalarSchema>;');
    expect(out).toContain('export type Shape = CircleDto | GroupDto;');
    expect(out).toContain('export const ShapeSchema: z.ZodType<Shape> =');
  });

  it('emits every alias in topological order (a bare reference declared first)', () => {
    // `Scalar` has no dependency; `Shape` references only cyclic entities.
    const order = ['Scalar', 'Shape'].map((n) =>
      out.indexOf(`export const ${n}Schema`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('renders a discriminated union as z.discriminatedUnion, lazy over cyclic refs only', () => {
    expect(out).toContain(
      'export const ShapeSchema: z.ZodType<Shape> = z.discriminatedUnion("kind", [CircleSchema, z.lazy(() => GroupSchema)]);',
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
