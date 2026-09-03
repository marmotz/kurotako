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
import { schemaName, VARIANT_TOKEN, type VariantName } from '../names.js';

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
