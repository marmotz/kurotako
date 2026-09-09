/** Assemble the TypeScript generator's full artifact symbol matrix. */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import { iterEntities } from '@kurotako/ir';
import { collectEnums } from './emit/enums.js';
import {
  barrelModule,
  entityModule,
  enumConst,
  enumsModule,
  enumTypeName,
  FAMILIES,
  FAMILY_TOKEN,
  type FamilyName,
  filtersModule,
  scalarsModule,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type VariantName,
} from './names.js';

export interface TypeScriptArtifactExtra {
  families: ['flat', 'deep'];
  variants: ['full', 'create', 'update', 'where', 'select'];
  perNamespace: Record<
    string,
    {
      barrelModule: string;
      filtersModule: string;
      scalarsModule: string;
      enums: Record<
        string,
        { constName: string; typeName: string; module: string }
      >;
    }
  >;
}

function roleStem(variant: VariantName, family: FamilyName): string {
  const variantStem = variant === 'full' ? '' : variant;
  return family === 'flat'
    ? variantStem
    : variantStem === ''
      ? 'deep'
      : `${variantStem}Deep`;
}

function entitySymbols(name: string): Record<string, string> {
  const symbols: Record<string, string> = {};
  for (const variant of VARIANTS) {
    for (const family of FAMILIES) {
      const stem = roleStem(variant, family);
      const key = stem === '' ? 'type' : `${stem}Type`;
      symbols[key] = typeName(
        name,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
    }
  }
  return symbols;
}

/** Build the consumable metadata independently of file emission. */
export function buildArtifact(ir: IR): GeneratorArtifact {
  const entities: Record<string, EntitySymbols> = {};
  for (const { namespace, entity } of iterEntities(ir)) {
    entities[`${namespace}.${entity.name}`] = {
      module: entityModule(namespace, entity.name),
      symbols: entitySymbols(entity.name),
    };
  }

  const perNamespace: TypeScriptArtifactExtra['perNamespace'] = {};
  for (const [namespace, source] of Object.entries(ir.sources)) {
    const enums: TypeScriptArtifactExtra['perNamespace'][string]['enums'] = {};
    for (const definition of collectEnums(source)) {
      enums[definition.name] = {
        constName: enumConst(definition.name),
        typeName: enumTypeName(definition.name),
        module: enumsModule(namespace),
      };
    }
    perNamespace[namespace] = {
      barrelModule: barrelModule(namespace),
      filtersModule: filtersModule(namespace),
      scalarsModule: scalarsModule(namespace),
      enums,
    };
  }

  return {
    entities,
    extra: {
      families: ['flat', 'deep'],
      variants: ['full', 'create', 'update', 'where', 'select'],
      perNamespace,
    } satisfies TypeScriptArtifactExtra,
  };
}
