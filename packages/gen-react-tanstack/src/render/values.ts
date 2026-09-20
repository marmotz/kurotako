/**
 * The form values type of a hook: the Zod DTO, with every recursive part cut.
 *
 * TanStack Form derives its field paths (`DeepKeys<T>`) with an unbounded recursion,
 * so a values type that refers back to itself (a `ref` cycle such as a tree node's
 * `parent`, or the ordinary `User.posts` / `Post.author` relation pair in deep mode)
 * makes the compiler give up with TS2589 as soon as the form API is used. This module
 * plans the type so it is finite:
 *
 * - a field whose type reaches a `ref` cycle is typed `unknown`;
 * - in deep mode a relation is followed (typed with the target's own DTO, itself cut)
 *   only down to `MAX_RELATION_DEPTH` levels and never back to an entity already on
 *   the path; any other relation is left out of the values.
 *
 * When nothing is cut the values type is the DTO itself.
 */
import type { Logger } from '@kurotako/core';
import type { Entity, Field, SourceIR } from '@kurotako/ir';
import { collectRefNames } from '@kurotako/ir';
import type { Variant } from '../names.js';
import type { ImportsRecorder } from './imports.js';
import type { DeepRelation } from './relations.js';
import { deepRelations } from './relations.js';
import { variantFields } from './variants.js';

/** Relation levels below the root that a values type spells out. */
const MAX_RELATION_DEPTH = 2;

export interface ValuesContext {
  namespace: string;
  source: SourceIR;
  variant: Variant;
  deep: boolean;
  /** `${namespace}.${name}` of every entity / alias in a `ref` cycle. */
  cycles: ReadonlySet<string>;
  /** The Zod `type` role identifier + module of an entity, for the deep DTO of this variant. */
  dto: (entity: string) => { typeName: string; module: string };
  imports: ImportsRecorder;
  logger?: Logger;
}

/** Whether a field type reaches (through refs and aliases) a `ref` cycle. */
function reachesCycle(
  names: Iterable<string>,
  ctx: ValuesContext,
  seen: Set<string>,
): boolean {
  for (const name of names) {
    if (ctx.cycles.has(`${ctx.namespace}.${name}`)) {
      return true;
    }
    if (seen.has(name)) {
      continue;
    }
    seen.add(name);
    const entity = ctx.source.entities[name];
    const alias = ctx.source.typeAliases?.[name];
    const next = new Set<string>();
    for (const field of entity?.fields ?? []) {
      collectRefNames(field.type, next);
    }
    if (alias !== undefined) {
      collectRefNames(alias.type, next);
    }
    if (reachesCycle(next, ctx, seen)) {
      return true;
    }
  }
  return false;
}

function isCutField(field: Field, ctx: ValuesContext): boolean {
  return reachesCycle(collectRefNames(field.type), ctx, new Set());
}

/**
 * Whether a to-one relation `entity -> target` would recurse forever when seeded:
 * the target reaches `entity` again through to-one relations only.
 */
export function isToOneCycle(
  entity: string,
  target: string,
  ctx: Pick<ValuesContext, 'namespace' | 'source'>,
): boolean {
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const name = stack.pop();
    if (name === undefined || seen.has(name)) {
      continue;
    }
    if (name === entity) {
      return true;
    }
    seen.add(name);
    const node = ctx.source.entities[name];
    for (const rel of node?.relations ?? []) {
      if (
        rel.cardinality !== 'many' &&
        rel.target.namespace === ctx.namespace
      ) {
        stack.push(rel.target.entity);
      }
    }
  }
  return false;
}

function isFollowed(
  rel: DeepRelation,
  entity: string,
  path: readonly string[],
  ctx: ValuesContext,
): boolean {
  const target = rel.relation.target.entity;
  return (
    path.length < MAX_RELATION_DEPTH &&
    target !== entity &&
    !path.includes(target) &&
    ctx.source.entities[target] !== undefined
  );
}

/** The relations of the root entity that the values type spells out (deep mode). */
export function followedRelations(
  entity: Entity,
  ctx: ValuesContext,
): DeepRelation[] {
  if (!ctx.deep) {
    return [];
  }
  return deepRelations(entity, ctx.namespace, ctx.logger).filter((rel) =>
    isFollowed(rel, entity.name, [], ctx),
  );
}

/** Field names of the root entity typed `unknown` because they reach a `ref` cycle. */
export function cutFields(entity: Entity, ctx: ValuesContext): Set<string> {
  return new Set(
    variantFields(entity, ctx.variant)
      .filter((field) => isCutField(field, ctx))
      .map((field) => field.name),
  );
}

const quote = (name: string): string => JSON.stringify(name);

function nodeType(
  entity: Entity,
  path: readonly string[],
  ctx: ValuesContext,
): string {
  const { typeName, module } = ctx.dto(entity.name);
  ctx.imports.type(module, typeName);

  const omitted: string[] = [];
  const added: string[] = [];
  for (const field of variantFields(entity, ctx.variant)) {
    if (isCutField(field, ctx)) {
      omitted.push(field.name);
      added.push(`${field.name}?: unknown`);
    }
  }
  if (ctx.deep) {
    for (const rel of deepRelations(entity, ctx.namespace)) {
      const name = rel.relation.name;
      omitted.push(name);
      if (!isFollowed(rel, entity.name, path, ctx)) {
        continue;
      }
      const target = ctx.source.entities[rel.relation.target.entity];
      if (target === undefined) {
        continue;
      }
      let nested = nodeType(target, [...path, entity.name], ctx);
      if (nested.includes(' & ')) {
        nested = `(${nested})`;
      }
      const optional =
        rel.relation.optional || rel.many || ctx.variant === 'update';
      added.push(
        `${name}${optional ? '?' : ''}: ${rel.many ? `${nested}[]` : nested}`,
      );
    }
  }

  if (omitted.length === 0) {
    return typeName;
  }
  const base = `Omit<${typeName}, ${omitted.map(quote).join(' | ')}>`;
  return added.length === 0 ? base : `${base} & { ${added.join('; ')} }`;
}

/** The text of the values type of `entity` for `ctx.variant`. */
export function valuesTypeText(entity: Entity, ctx: ValuesContext): string {
  return nodeType(entity, [], ctx);
}
