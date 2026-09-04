/**
 * Flat (FK id) vs deep (`z.lazy` nested) relation rendering.
 *
 * - flat family: nothing extra — the FK scalar `Field`s (`relation.fkFields`)
 *   already carry the id, so `relationExpr` returns `null`.
 * - deep family: `z.lazy(() => <Target><Variant>DeepSchema)`, wrapped in
 *   `z.array(...)` for a to-many relation.
 * - cross-source relations degrade to the flat representation (FK id only) and
 *   log at `debug` — v1 cannot deterministically import across namespace dirs.
 */
import type { Logger } from '@kurotako/core';
import type { Relation } from '@kurotako/ir';
import { isCrossSource } from '@kurotako/ir';
import type { FamilyName } from '../names.js';
import {
  schemaName,
  typeName,
  VARIANT_TOKEN,
  type VariantName,
} from '../names.js';

export interface RelationExprOptions {
  fromNamespace: string;
  logger?: Logger;
}

export function relationExpr(
  rel: Relation,
  family: FamilyName,
  variant: VariantName,
  opts: RelationExprOptions,
): string | null {
  if (family === 'flat') {
    return null;
  }
  if (isCrossSource(opts.fromNamespace, rel)) {
    opts.logger?.debug(
      `gen-zod: relation '${rel.name}' targets another source ('${rel.target.namespace}.${rel.target.entity}'); degrading to the FK id (flat) in the deep family`,
    );
    return null;
  }

  const target = rel.target.entity;
  const many = rel.cardinality === 'many';

  if (variant === 'where') {
    const inner = `z.lazy(() => ${schemaName(target, 'Where', 'Deep')})`;
    if (many) {
      return `z.object({ some: ${inner}.optional(), every: ${inner}.optional(), none: ${inner}.optional() }).optional()`;
    }
    return `${inner}.optional()`;
  }

  if (variant === 'select') {
    return `z.union([z.boolean(), z.lazy(() => ${schemaName(target, 'Select', 'Deep')})]).optional()`;
  }

  const nested = schemaName(target, VARIANT_TOKEN[variant], 'Deep');
  let expr = `z.lazy(() => ${nested})`;
  if (many) {
    expr = `z.array(${expr})`;
  }
  if (rel.optional || many) {
    expr += '.optional()';
  }
  return expr;
}

/**
 * The TS-type sibling of `relationExpr`. A `deep`-family relation field's type
 * always names the *target*'s hand-written `Dto` (never `z.infer<typeof
 * <name>Schema>`), because two entities with relations pointing at each other
 * — the ordinary shape of a Prisma one-to-many/many-to-one pair, not an edge
 * case — makes every relation-carrying `z.object(...)` mutually circular:
 * TypeScript can't emit a `.d.ts` for a value whose type can only be inferred
 * by inferring the other value's type, which in turn needs this one's.
 * Naming the type explicitly breaks the cycle (mutually recursive `type`
 * aliases, unlike const initializers, are fine).
 */
export interface RelationType {
  /** The bare TS type — never includes `| undefined`; see `optional`. */
  type: string;
  /** Whether the *field* is optional (`fieldName?:`) at this variant. */
  optional: boolean;
}

export function relationTypeExpr(
  rel: Relation,
  family: FamilyName,
  variant: VariantName,
  opts: RelationExprOptions,
): RelationType | null {
  if (family === 'flat') {
    return null;
  }
  if (isCrossSource(opts.fromNamespace, rel)) {
    return null;
  }

  const target = rel.target.entity;
  const many = rel.cardinality === 'many';

  if (variant === 'where') {
    const dto = typeName(target, 'Where', 'Deep');
    return {
      type: many ? `{ some?: ${dto}; every?: ${dto}; none?: ${dto} }` : dto,
      optional: true,
    };
  }

  if (variant === 'select') {
    const dto = typeName(target, 'Select', 'Deep');
    return { type: `boolean | ${dto}`, optional: true };
  }

  const dto = typeName(target, VARIANT_TOKEN[variant], 'Deep');
  return {
    type: many ? `${dto}[]` : dto,
    // `update` wraps the whole object in `.partial()`, so every field —
    // required relation included — ends up optional at runtime.
    optional: rel.optional || many || variant === 'update',
  };
}
