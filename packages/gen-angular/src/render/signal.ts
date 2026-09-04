/**
 * Signal Forms surface: pure exported `schema` + model-factory functions, no DI
 * wrapper (`generator-angular/technical.md` §Signal Forms schema + model
 * factory), plus a `create<Entity><Variant>Form` convenience wrapper around
 * `form(signal(model), schema)`. Every `@angular/forms/signals` call site
 * lives here and in `emit/runtime.ts` (the `zodTreeValidate` half) so a
 * secondary-API change on that experimental surface is a single-file update.
 *
 * The wrapper is a plain function, not a DI service — `form()` resolves its
 * injector from Angular's ambient injection context when none is passed
 * explicitly (same rule `inject()` follows), so calling the wrapper from a
 * component field initializer or constructor works exactly like calling
 * `form()` inline there.
 */
import type { GeneratorArtifact, Logger } from '@kurotako/core';
import type { Entity, SourceIR } from '@kurotako/ir';
import {
  modelFactoryName,
  signalFormFactoryName,
  signalSchemaName,
  type Variant,
} from '../names.js';
import type { AngularGeneratorOptions } from '../options.js';
import { zodModule, zodSymbol } from '../zod-artifact.js';
import { enumZeroFromSource, initExpr } from './controls.js';
import type { ImportsRecorder } from './imports.js';
import { deepRelations } from './relations.js';
import { variantFields } from './variants.js';

export function signalEntity(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  imports: ImportsRecorder,
  logger?: Logger,
): string {
  const deep = options.relations === 'deep';
  const enumZero = enumZeroFromSource(source, entity);
  imports.value('@angular/forms/signals', 'schema');
  imports.value('@angular/forms/signals', 'form');
  imports.type('@angular/forms/signals', 'FieldTree');
  imports.value('@angular/core', 'signal');

  const blocks: string[] = [];
  for (const variant of ['Create', 'Update'] as Variant[]) {
    const typeRole =
      deep && variant === 'Create'
        ? ('createDeepType' as const)
        : deep && variant === 'Update'
          ? ('updateDeepType' as const)
          : variant === 'Create'
            ? ('createType' as const)
            : ('updateType' as const);
    const schemaRole =
      deep && variant === 'Create'
        ? ('createDeepSchema' as const)
        : deep && variant === 'Update'
          ? ('updateDeepSchema' as const)
          : variant === 'Create'
            ? ('createSchema' as const)
            : ('updateSchema' as const);

    const module = zodModule(zod, namespace, entity.name);
    const typeId = zodSymbol(zod, namespace, entity.name, typeRole);
    const schemaId = zodSymbol(zod, namespace, entity.name, schemaRole);
    imports.type(module, typeId);
    imports.value(module, schemaId);
    imports.value(`${namespace}/angular/zod-forms.runtime`, 'zodTreeValidate');

    const fields = variantFields(entity, variant);
    const fieldLines = fields.map(
      (field) =>
        `    ${field.name}: init?.${field.name} ?? ${initExpr(field, enumZero)},`,
    );

    const relations = deep
      ? deepRelations(entity, variant, namespace, logger)
      : [];
    // A to-one relation the Zod deep DTO marks required (any relation that
    // isn't itself optional, in the Create variant) can't be seeded with
    // `undefined` — build it eagerly via the target's own model factory
    // instead, imported as a value from its `.form` module.
    const relationLines = relations.map((rel) => {
      if (rel.many) {
        return `    ${rel.relation.name}: [],`;
      }
      const targetModule = `${namespace}/angular/${rel.relation.target.entity}.form`;
      const targetModelFactory = modelFactoryName(
        rel.relation.target.entity,
        variant,
      );
      imports.value(targetModule, targetModelFactory);
      return `    ${rel.relation.name}: ${targetModelFactory}(init?.${rel.relation.name}),`;
    });

    const modelBody = [...fieldLines, ...relationLines].join('\n');
    const modelName = modelFactoryName(entity.name, variant);
    blocks.push(
      `export function ${modelName}(init?: Partial<${typeId}>): ${typeId} {\n  return {\n${modelBody}\n  };\n}`,
    );

    const schemaConst = signalSchemaName(entity.name, variant);
    blocks.push(
      `export const ${schemaConst} = schema<${typeId}>((path) => {\n  zodTreeValidate(path, ${schemaId});\n});`,
    );

    const formFactoryName = signalFormFactoryName(entity.name, variant);
    blocks.push(
      `export function ${formFactoryName}(init?: Partial<${typeId}>): FieldTree<${typeId}> {\n  return form(signal(${modelName}(init)), ${schemaConst});\n}`,
    );
  }

  return blocks.join('\n\n');
}
