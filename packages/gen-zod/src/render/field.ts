/**
 * `Field` -> full Zod expression: base + constraint chain, then `z.array(...)`
 * for a list, `.nullable()`, variant-driven `.optional()`, and — in the `create`
 * variant only — `.default(<json>)` for a literal default.
 */
import type { Field } from '@kurotako/ir';
import type { ZodDialect } from '../dialect.js';
import type { VariantName } from '../names.js';
import { applyConstraints } from './constraints.js';
import { baseClass, baseExpr, unknownHintComment } from './scalars.js';

export interface FieldExprOptions {
  /** Whether this field is optional in the current variant. */
  optional: boolean;
  variant: VariantName;
}

export function fieldExpr(
  field: Field,
  opts: FieldExprOptions,
  dialect: ZodDialect,
): string {
  let expr = applyConstraints(
    baseExpr(field.type, dialect),
    field.constraints,
    baseClass(field.type),
    dialect,
  );

  if (field.list) {
    expr = `z.array(${expr})`;
  }
  if (field.nullable) {
    expr += '.nullable()';
  }
  if (opts.optional) {
    expr += '.optional()';
  }
  if (
    opts.variant === 'create' &&
    field.default !== undefined &&
    field.default.kind === 'value'
  ) {
    expr += `.default(${JSON.stringify(field.default.value)})`;
  }

  const comment = unknownHintComment(field.type);
  return comment === null ? expr : `${expr} ${comment}`;
}
