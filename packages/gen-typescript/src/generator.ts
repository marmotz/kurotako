/** `typescriptGenerator` — emits pure TypeScript declarations from the IR. */
import { defineGenerator } from '@kurotako/config';
import type { GenerateContext, GenOutput, VirtualFile } from '@kurotako/core';
import { buildArtifact } from './artifact.js';
import { emitAliases } from './emit/aliases.js';
import { emitBarrel } from './emit/barrel.js';
import { emitEntity } from './emit/entity.js';
import { collectEnums, emitEnums } from './emit/enums.js';
import { collectFilterNames, emitFilters } from './emit/filters.js';
import { emitScalars } from './emit/scalars.js';
import {
  TypeScriptAliasCycleError,
  TypeScriptAliasPublicNameCollisionError,
  TypeScriptEnumPublicNameCollisionError,
} from './errors.js';
import {
  FAMILIES,
  FAMILY_TOKEN,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
} from './names.js';
import { collectTypeDependencies } from './render/scalars.js';

function sourceUsesJsonValue(
  source: GenerateContext['ir']['sources'][string],
): boolean {
  for (const entity of Object.values(source.entities)) {
    for (const field of entity.fields) {
      if (collectTypeDependencies(field.type, source, entity).usesJsonValue) {
        return true;
      }
    }
  }
  for (const alias of Object.values(source.typeAliases ?? {})) {
    if (collectTypeDependencies(alias.type, source, undefined).usesJsonValue) {
      return true;
    }
  }
  return false;
}

/**
 * Return aliases that participate in an alias-only `ref` cycle. A cycle passing
 * through an entity is valid TypeScript because the entity emits a structural
 * object type; bare aliases have no such structure to break the recursion.
 */
function cyclicAliasNames(
  source: GenerateContext['ir']['sources'][string],
  cycles: GenerateContext['cycles'],
): string[] {
  const aliases = source.typeAliases ?? {};
  const candidates = Object.keys(aliases).filter((name) =>
    cycles.has(`${source.namespace}.${name}`),
  );
  const candidateSet = new Set(candidates);
  const references = new Map<string, string[]>();

  for (const name of candidates) {
    const alias = aliases[name];
    if (alias === undefined) continue;
    const dependencies = collectTypeDependencies(alias.type, source, undefined);
    references.set(
      name,
      [...dependencies.aliases].filter((dependency) =>
        candidateSet.has(dependency),
      ),
    );
  }

  const reachesSelf = (start: string, current: string, seen: Set<string>) => {
    for (const next of references.get(current) ?? []) {
      if (next === start) return true;
      if (!seen.has(next)) {
        seen.add(next);
        if (reachesSelf(start, next, seen)) return true;
      }
    }
    return false;
  };

  return candidates.filter((name) => reachesSelf(name, name, new Set([name])));
}

/** Public barrel identifiers, separated by their enum, generated, and alias origins. */
function generatedPublicNames(
  source: GenerateContext['ir']['sources'][string],
): {
  enumNames: Set<string>;
  generatedTypeNames: Set<string>;
  aliasNames: Set<string>;
} {
  // An enum's const and type intentionally share one identifier in TypeScript's
  // separate value and type namespaces, so it is recorded only once here.
  const enumNames = new Set(collectEnums(source).map(({ name }) => name));
  const generatedTypeNames = new Set<string>();

  for (const entity of Object.values(source.entities)) {
    for (const variant of VARIANTS) {
      for (const family of FAMILIES) {
        generatedTypeNames.add(
          typeName(entity.name, VARIANT_TOKEN[variant], FAMILY_TOKEN[family]),
        );
      }
    }
  }

  for (const name of collectFilterNames(source)) generatedTypeNames.add(name);
  if (sourceUsesJsonValue(source)) generatedTypeNames.add('JsonValue');
  return {
    enumNames,
    generatedTypeNames,
    aliasNames: new Set(Object.keys(source.typeAliases ?? {})),
  };
}

function validateSourceEmission(
  source: GenerateContext['ir']['sources'][string],
  cycles: GenerateContext['cycles'],
): void {
  const aliasesInCycles = cyclicAliasNames(source, cycles);
  if (aliasesInCycles.length > 0) {
    throw new TypeScriptAliasCycleError(source.namespace, aliasesInCycles);
  }

  const { enumNames, generatedTypeNames, aliasNames } =
    generatedPublicNames(source);
  const aliasCollisions = [...aliasNames].filter(
    (name) => enumNames.has(name) || generatedTypeNames.has(name),
  );
  if (aliasCollisions.length > 0) {
    throw new TypeScriptAliasPublicNameCollisionError(
      source.namespace,
      aliasCollisions,
    );
  }

  const enumCollisions = [...enumNames].filter(
    (name) => generatedTypeNames.has(name) || aliasNames.has(name),
  );
  if (enumCollisions.length > 0) {
    throw new TypeScriptEnumPublicNameCollisionError(
      source.namespace,
      enumCollisions,
    );
  }
}

/** Pure, synchronous generator with no runtime dependency on generated code. */
export const typescriptGenerator = defineGenerator({
  name: 'typescript',

  generate(ctx: GenerateContext): GenOutput {
    const files: VirtualFile[] = [];
    for (const [namespace, source] of Object.entries(ctx.ir.sources)) {
      validateSourceEmission(source, ctx.cycles);
      const prefix = `${namespace}/typescript`;
      const emitsScalars = sourceUsesJsonValue(source);
      if (emitsScalars) {
        files.push({ path: `${prefix}/scalars.ts`, content: emitScalars() });
      }
      files.push({ path: `${prefix}/enums.ts`, content: emitEnums(source) });
      if (Object.keys(source.entities).length > 0) {
        files.push({
          path: `${prefix}/filters.ts`,
          content: emitFilters(source),
        });
      }
      if (Object.keys(source.typeAliases ?? {}).length > 0) {
        files.push({
          path: `${prefix}/aliases.ts`,
          content: emitAliases(source),
        });
      }
      for (const entity of Object.values(source.entities)) {
        files.push({
          path: `${prefix}/${entity.name}.type.ts`,
          content: emitEntity(source, entity, ctx.logger),
        });
      }
      files.push({
        path: `${prefix}/index.ts`,
        content: emitBarrel(
          source,
          emitsScalars,
          Object.keys(source.typeAliases ?? {}).length > 0,
        ),
      });
    }
    return { files, artifact: buildArtifact(ctx.ir) };
  },
});
