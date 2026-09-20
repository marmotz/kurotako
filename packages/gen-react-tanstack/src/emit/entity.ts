/**
 * One entity -> `<ns>/react-tanstack/<entity>.form.ts` source text: a sorted import
 * block, then, per selected variant, the values type, the default-values function,
 * the form API type, the options interface and the hook.
 */
import type { GeneratorArtifact, Logger } from '@kurotako/core';
import type { Entity, SourceIR } from '@kurotako/ir';
import {
  apiTypeName,
  defaultValuesName,
  hookName,
  optionsTypeName,
  runtimeModule,
  type Variant,
  valuesTypeName,
} from '../names.js';
import type { ReactTanstackGeneratorOptions } from '../options.js';
import { defaultValuesFunction } from '../render/defaults.js';
import { ImportsRecorder } from '../render/imports.js';
import { type ValuesContext, valuesTypeText } from '../render/values.js';
import { zodModule, zodRoles, zodSymbol } from '../zod-artifact.js';

function variantBlock(
  entity: Entity,
  variant: Variant,
  namespace: string,
  source: SourceIR,
  options: ReactTanstackGeneratorOptions,
  zod: GeneratorArtifact,
  imports: ImportsRecorder,
  emitted: ReadonlySet<string>,
  cycles: ReadonlySet<string>,
  logger?: Logger,
): string {
  const deep = options.relations === 'deep';
  const roles = zodRoles(variant, deep);
  const module = zodModule(zod, namespace, entity.name);
  const schemaId = zodSymbol(zod, namespace, entity.name, roles.schema);
  const runtime = runtimeModule(namespace);

  const ctx: ValuesContext = {
    namespace,
    source,
    variant,
    deep,
    cycles,
    dto: (name) => ({
      typeName: zodSymbol(zod, namespace, name, roles.type),
      module: zodModule(zod, namespace, name),
    }),
    imports,
    logger,
  };
  const values = valuesTypeName(entity.name, variant);

  imports.value(module, schemaId);
  imports.value(runtime, 'useZodForm');
  imports.type(runtime, 'ZodFormApi');
  imports.type(runtime, 'ZodFormConfig');
  imports.type(runtime, 'ZodFormSchema');

  const defaults = defaultValuesName(entity.name, variant);
  const api = apiTypeName(entity.name, variant);
  const optionsType = optionsTypeName(entity.name, variant);
  const hook = hookName(entity.name, variant);

  return [
    `export type ${values} = ${valuesTypeText(entity, ctx)};`,
    defaultValuesFunction(entity, values, ctx, emitted),
    `export type ${api} = ZodFormApi<${values}>;`,
    `export interface ${optionsType}
  extends Omit<ZodFormConfig<${values}>, 'defaultValues' | 'schema'> {
  defaultValues?: Partial<${values}>;
  /** Replaces the generated schema, e.g. a refined or extended one built at runtime. */
  schema?: ZodFormSchema<${values}>;
}`,
    `export function ${hook}(options: ${optionsType} = {}): ${api} {
  const { defaultValues, schema, ...rest } = options;
  return useZodForm<${values}>({
    ...rest,
    defaultValues: ${defaults}(defaultValues),
    schema: schema ?? ${schemaId},
  });
}`,
  ].join('\n\n');
}

export function emitEntity(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  options: ReactTanstackGeneratorOptions,
  zod: GeneratorArtifact,
  emitted: ReadonlySet<string>,
  cycles: ReadonlySet<string>,
  logger?: Logger,
): string {
  const imports = new ImportsRecorder();
  const blocks = options.variants.map((variant) =>
    variantBlock(
      entity,
      variant,
      namespace,
      source,
      options,
      zod,
      imports,
      emitted,
      cycles,
      logger,
    ),
  );
  return `${[imports.render(), '', blocks.join('\n\n')].join('\n').trimEnd()}\n`;
}
