/** Flat versus deep relation members. */
import type { Logger } from '@kurotako/core';
import type { Relation } from '@kurotako/ir';
import { isCrossSource } from '@kurotako/ir';
import {
  type FamilyName,
  typeName,
  VARIANT_TOKEN,
  type VariantName,
} from '../names.js';

export interface RelationMember {
  type: string;
  optional: boolean;
}

export interface RelationMemberOptions {
  fromNamespace: string;
  logger?: Logger;
}

/**
 * Render a relation member for the deep family. Cross-source links deliberately
 * stay flat because v1 has no stable cross-namespace module mapping.
 */
export function relationMember(
  relation: Relation,
  family: FamilyName,
  variant: VariantName,
  opts: RelationMemberOptions,
): RelationMember | null {
  if (family === 'flat') return null;
  if (isCrossSource(opts.fromNamespace, relation)) {
    opts.logger?.debug(
      `gen-typescript: relation '${relation.name}' targets another source ('${relation.target.namespace}.${relation.target.entity}'); degrading to the FK id (flat) in the deep family`,
    );
    return null;
  }

  const target = relation.target.entity;
  const many = relation.cardinality === 'many';
  if (variant === 'where') {
    const dto = typeName(target, 'Where', 'Deep');
    return {
      type: many ? `{ some?: ${dto}; every?: ${dto}; none?: ${dto} }` : dto,
      optional: true,
    };
  }
  if (variant === 'select') {
    return {
      type: `boolean | ${typeName(target, 'Select', 'Deep')}`,
      optional: true,
    };
  }

  return {
    type: many
      ? `${typeName(target, VARIANT_TOKEN[variant], 'Deep')}[]`
      : typeName(target, VARIANT_TOKEN[variant], 'Deep'),
    optional: relation.optional || many || variant === 'update',
  };
}
