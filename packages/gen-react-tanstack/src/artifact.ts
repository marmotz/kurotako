/**
 * Assemble the `GeneratorArtifact`: the entity symbol matrix, the
 * `@tanstack/react-form` peer dependency and `ReactTanstackArtifactExtra`.
 * No generator depends on `react-tanstack` in v1; the artifact exists for
 * uniformity and future consumers.
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import {
  apiTypeName,
  barrelModule,
  defaultValuesName,
  entityModule,
  hookName,
  optionsTypeName,
  runtimeModule,
  type Variant,
  valuesTypeName,
} from './names.js';
import type { ReactTanstackGeneratorOptions } from './options.js';

/**
 * Lowest `@tanstack/react-form` release exporting `revalidateLogic` (and the
 * `onDynamic` validator it drives).
 */
export const TANSTACK_FORM_RANGE = '^1.17.0';

export interface ReactTanstackArtifactExtra {
  variants: Variant[];
  relations: 'flat' | 'deep';
  /** Echoed from the consumed `ZodArtifactExtra`. */
  zodVersion: 3 | 4;
  perNamespace: Record<
    string,
    {
      runtimeModule: string;
      barrelModule: string;
    }
  >;
}

/** `hook` / `options` / `api` / `values` / `defaultValues` for `full`, `createHook` / ... for the others. */
function roleKey(variant: Variant, role: string): string {
  return variant === 'full'
    ? role
    : `${variant}${role.charAt(0).toUpperCase()}${role.slice(1)}`;
}

function entitySymbols(
  entity: string,
  variants: readonly Variant[],
): Record<string, string> {
  const symbols: Record<string, string> = {};
  for (const variant of variants) {
    symbols[roleKey(variant, 'hook')] = hookName(entity, variant);
    symbols[roleKey(variant, 'values')] = valuesTypeName(entity, variant);
    symbols[roleKey(variant, 'options')] = optionsTypeName(entity, variant);
    symbols[roleKey(variant, 'api')] = apiTypeName(entity, variant);
    symbols[roleKey(variant, 'defaultValues')] = defaultValuesName(
      entity,
      variant,
    );
  }
  return symbols;
}

/**
 * `emitted` maps a namespace to the entity names emitted in it (after `include`
 * filtering); `zodVersion` is the private Zod copy's flavor.
 */
export function buildArtifact(
  ir: IR,
  emitted: ReadonlyMap<string, readonly string[]>,
  zodVersion: 3 | 4,
  options: ReactTanstackGeneratorOptions,
): GeneratorArtifact {
  const entities: Record<string, EntitySymbols> = {};
  const perNamespace: ReactTanstackArtifactExtra['perNamespace'] = {};

  for (const namespace of Object.keys(ir.sources)) {
    for (const entity of emitted.get(namespace) ?? []) {
      entities[`${namespace}.${entity}`] = {
        module: entityModule(namespace, entity),
        symbols: entitySymbols(entity, options.variants),
      };
    }
    perNamespace[namespace] = {
      runtimeModule: runtimeModule(namespace),
      barrelModule: barrelModule(namespace),
    };
  }

  const extra: ReactTanstackArtifactExtra = {
    variants: [...options.variants],
    relations: options.relations,
    zodVersion,
    perNamespace,
  };

  return {
    entities,
    peerDependencies: { '@tanstack/react-form': TANSTACK_FORM_RANGE },
    extra,
  };
}
