/**
 * Typed reader over `ctx.dependencies.zod` (the `GeneratorArtifact` produced by
 * `@kurotako/gen-zod`). `dependsOn: ['zod']` guarantees the entry is present;
 * this module only resolves identifiers + module specifiers, never re-derives a
 * Zod name (`generator-angular/technical.md` §Naming).
 *
 * Role keys consumed here (a subset of `gen-zod`'s full matrix): `createSchema`,
 * `createType`, `updateSchema`, `updateType`, and — in `relations: 'deep'` mode
 * only — `createDeepSchema`, `createDeepType`, `updateDeepSchema`,
 * `updateDeepType`.
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { ZodArtifactExtra } from '@kurotako/gen-zod';
import { MissingZodNamespaceError, MissingZodSymbolError } from './errors.js';

export type ZodRole =
  | 'createSchema'
  | 'createType'
  | 'updateSchema'
  | 'updateType'
  | 'createDeepSchema'
  | 'createDeepType'
  | 'updateDeepSchema'
  | 'updateDeepType';

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
  const key = entityKey(namespace, entity);
  const entry = zodEntity(zod, namespace, entity);
  const id = entry.symbols[role];
  if (id === undefined) {
    throw new MissingZodSymbolError(key, role);
  }
  return id;
}

/** The module specifier a sibling generator imports an entity's Zod schema from. */
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

/** `extra.perNamespace[ns]`, or throw if the Zod artifact never saw that namespace. */
export function zodNamespaceExtra(
  zod: GeneratorArtifact,
  namespace: string,
): ZodArtifactExtra['perNamespace'][string] {
  const per = zodExtra(zod).perNamespace[namespace];
  if (per === undefined) {
    throw new MissingZodNamespaceError(namespace);
  }
  return per;
}

/** `{ typeName, module }` for an enum ref, resolved via `extra.perNamespace[ns].enums`. */
export function zodEnum(
  zod: GeneratorArtifact,
  namespace: string,
  ref: string,
): { typeName: string; module: string } {
  const per = zodNamespaceExtra(zod, namespace);
  const def = per.enums[ref];
  if (def === undefined) {
    throw new MissingZodSymbolError(`${namespace}.<enum>`, ref);
  }
  return { typeName: def.typeName, module: def.module };
}
