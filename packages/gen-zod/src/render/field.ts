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

/** `fieldExpr`'s result: the Zod expression, plus its trailing `unknown`-hint
 * comment (`// unknown[: hint]`), separately, since it's up to the caller to
 * place it relative to whatever delimiter follows the expression. */
export interface FieldExprResult {
  expr: string;
  comment: string | null;
}

export function fieldExpr(
  field: Field,
  opts: FieldExprOptions,
  dialect: ZodDialect,
  cyclicRefs?: ReadonlySet<string>,
): FieldExprResult {
  let expr = applyConstraints(
    baseExpr(field.type, dialect, cyclicRefs),
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

  return { expr, comment: unknownHintComment(field.type) };
}
