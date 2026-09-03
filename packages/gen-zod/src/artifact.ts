/**
 * Assemble the `GeneratorArtifact` (entities symbol matrix + `ZodArtifactExtra`).
 *
 * `generator-angular` is a hard consumer: it reads `entities[k].symbols` (the
 * `Create` / `Update` / `*Deep*` roles) and `ZodArtifactExtra.perNamespace[ns].enums`,
 * never raw file paths. The shape is a required contract.
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import { iterEntities } from '@kurotako/ir';
import { collectEnums } from './emit/enums.js';
import {
  barrelModule,
  entityModule,
  enumConst,
  enumSchemaName,
  enumsModule,
  enumTypeName,
  FAMILIES,
  FAMILY_TOKEN,
  type FamilyName,
  filtersModule,
  schemaName,
  typeName,
  VARIANT_TOKEN,
  VARIANTS,
  type VariantName,
} from './names.js';
import type { ZodGeneratorOptions } from './options.js';

export interface ZodArtifactExtra {
  zodVersion: 3 | 4;
  families: ['flat', 'deep'];
  variants: ['full', 'create', 'update', 'where', 'select'];
  perNamespace: Record<
    string,
    {
      enumsModule: string;
      filtersModule: string;
      barrelModule: string;
      enums: Record<
        string,
        {
          constName: string;
          schemaName: string;
          typeName: string;
          module: string;
        }
      >;
    }
  >;
}

/** Role stem for a variant/family pair, e.g. `create` / `deep` / `createDeep`. */
function roleStem(variant: VariantName, family: FamilyName): string {
  const v = variant === 'full' ? '' : variant;
  if (family === 'flat') {
    return v;
  }
  return v === '' ? 'deep' : `${v}Deep`;
}

/** `role -> exported identifier` for one entity — the full names.ts matrix. */
function entitySymbols(entity: string): Record<string, string> {
  const symbols: Record<string, string> = {};
  for (const variant of VARIANTS) {
    for (const family of FAMILIES) {
      const stem = roleStem(variant, family);
      const schemaKey = stem === '' ? 'schema' : `${stem}Schema`;
      const typeKey = stem === '' ? 'type' : `${stem}Type`;
      symbols[schemaKey] = schemaName(
        entity,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
      symbols[typeKey] = typeName(
        entity,
        VARIANT_TOKEN[variant],
        FAMILY_TOKEN[family],
      );
    }
  }
  return symbols;
}

export function buildArtifact(
  ir: IR,
  opts: ZodGeneratorOptions,
): GeneratorArtifact {
  const entities: Record<string, EntitySymbols> = {};
  for (const { namespace, entity } of iterEntities(ir)) {
    entities[`${namespace}.${entity.name}`] = {
      module: entityModule(namespace, entity.name),
      symbols: entitySymbols(entity.name),
    };
  }

  const perNamespace: ZodArtifactExtra['perNamespace'] = {};
  for (const [namespace, source] of Object.entries(ir.sources)) {
    const enums: ZodArtifactExtra['perNamespace'][string]['enums'] = {};
    for (const def of collectEnums(source)) {
      enums[def.name] = {
        constName: enumConst(def.name),
        schemaName: enumSchemaName(def.name),
        typeName: enumTypeName(def.name),
        module: enumsModule(namespace),
      };
    }
    perNamespace[namespace] = {
      enumsModule: enumsModule(namespace),
      filtersModule: filtersModule(namespace),
      barrelModule: barrelModule(namespace),
      enums,
    };
  }

  const extra: ZodArtifactExtra = {
    zodVersion: opts.zodVersion,
    families: ['flat', 'deep'],
    variants: ['full', 'create', 'update', 'where', 'select'],
    perNamespace,
  };

  return {
    entities,
    peerDependencies: { zod: opts.zodVersion === 4 ? '^4' : '^3' },
    extra,
  };
}
