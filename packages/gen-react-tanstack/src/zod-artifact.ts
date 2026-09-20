/**
 * Typed reader over `ctx.dependencies.zod` (the `GeneratorArtifact` produced by
 * `@kurotako/gen-zod`, run as this generator's private dependency). This module
 * only resolves identifiers and module specifiers, never re-derives a Zod name.
 *
 * Roles consumed: `schema` / `type`, `createSchema` / `createType`,
 * `updateSchema` / `updateType` and, in `relations: 'deep'` mode, the `*Deep*`
 * equivalents.
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { ZodArtifactExtra } from '@kurotako/gen-zod';
import { MissingZodDependencyError, MissingZodSymbolError } from './errors.js';
import type { Variant } from './names.js';

export type ZodRole =
  | 'schema'
  | 'type'
  | 'createSchema'
  | 'createType'
  | 'updateSchema'
  | 'updateType'
  | 'deepSchema'
  | 'deepType'
  | 'createDeepSchema'
  | 'createDeepType'
  | 'updateDeepSchema'
  | 'updateDeepType';

/** The Zod `(schema, type)` role pair a variant is built on, per relations mode. */
export function zodRoles(
  variant: Variant,
  deep: boolean,
): { schema: ZodRole; type: ZodRole } {
  const stem = variant === 'full' ? '' : variant;
  const family = deep ? (stem === '' ? 'deep' : 'Deep') : '';
  const base = `${stem}${family}`;
  return {
    schema: (base === '' ? 'schema' : `${base}Schema`) as ZodRole,
    type: (base === '' ? 'type' : `${base}Type`) as ZodRole,
  };
}

/** Read `ctx.dependencies.zod`, or throw if the private dependency did not run. */
export function readZodDependency(
  dependencies: Record<string, GeneratorArtifact>,
): GeneratorArtifact {
  const zod = dependencies.zod;
  if (zod === undefined) {
    throw new MissingZodDependencyError();
  }
  return zod;
}

/** `${namespace}.${entity}` — the artifact's entity key. */
export function entityKey(namespace: string, entity: string): string {
  return `${namespace}.${entity}`;
}

/** The Zod `{ module, symbols }` entry for an entity, or throw if absent. */
export function zodEntity(
  zod: GeneratorArtifact,
  namespace: string,
  entity: string,
): EntitySymbols {
  const key = entityKey(namespace, entity);
  const entry = zod.entities[key];
  if (entry === undefined) {
    throw new MissingZodSymbolError(key, '<entity>');
  }
  return entry;
}

/** Resolve one `role` on an entity to its Zod-emitted identifier. */
export function zodSymbol(
  zod: GeneratorArtifact,
  namespace: string,
  entity: string,
  role: ZodRole,
): string {
  const id = zodEntity(zod, namespace, entity).symbols[role];
  if (id === undefined) {
    throw new MissingZodSymbolError(entityKey(namespace, entity), role);
  }
  return id;
}

/** The module specifier a sibling generator imports an entity's Zod symbols from. */
export function zodModule(
  zod: GeneratorArtifact,
  namespace: string,
  entity: string,
): string {
  return zodEntity(zod, namespace, entity).module;
}

/** `zod.extra`, cast to the published `ZodArtifactExtra` shape. */
export function zodExtra(zod: GeneratorArtifact): ZodArtifactExtra {
  return zod.extra as ZodArtifactExtra;
}
