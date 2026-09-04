/**
 * Assemble the `GeneratorArtifact` (entities symbol matrix +
 * `AngularArtifactExtra`). No generator depends on `angular` in v1; the
 * artifact exists for uniformity and future consumers
 * (`generator-angular/technical.md` §Artifact).
 */
import type { EntitySymbols, GeneratorArtifact } from '@kurotako/core';
import type { IR } from '@kurotako/ir';
import { iterEntities } from '@kurotako/ir';
import {
  barrelModule,
  controlsTypeName,
  entityModule,
  factoryName,
  formTypeName,
  modelFactoryName,
  runtimeModule,
  signalFormFactoryName,
  signalSchemaName,
} from './names.js';
import type { AngularGeneratorOptions } from './options.js';
import { zodExtra } from './zod-artifact.js';

export interface AngularArtifactExtra {
  forms: ('reactive' | 'signal')[];
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

function entitySymbols(
  entityName: string,
  options: AngularGeneratorOptions,
): Record<string, string> {
  const symbols: Record<string, string> = {};
  const deep = options.relations === 'deep';
  const family = deep ? 'Deep' : ('' as const);

  if (options.forms.includes('reactive')) {
    const createControls = controlsTypeName(entityName, 'Create', family);
    const createForm = formTypeName(entityName, 'Create', family);
    const updateControls = controlsTypeName(entityName, 'Update', family);
    const updateForm = formTypeName(entityName, 'Update', family);

    symbols.createControls = createControls;
    symbols.createForm = createForm;
    symbols.updateControls = updateControls;
    symbols.updateForm = updateForm;
    symbols.factory = factoryName(entityName);

    if (deep) {
      symbols.createDeepControls = createControls;
      symbols.createDeepForm = createForm;
      symbols.updateDeepControls = updateControls;
      symbols.updateDeepForm = updateForm;
    }
  }

  if (options.forms.includes('signal')) {
    symbols.createSchema = signalSchemaName(entityName, 'Create');
    symbols.updateSchema = signalSchemaName(entityName, 'Update');
    symbols.createModel = modelFactoryName(entityName, 'Create');
    symbols.updateModel = modelFactoryName(entityName, 'Update');
    symbols.createSignalForm = signalFormFactoryName(entityName, 'Create');
    symbols.updateSignalForm = signalFormFactoryName(entityName, 'Update');
  }

  return symbols;
}

export function buildArtifact(
  ir: IR,
  zod: GeneratorArtifact,
  options: AngularGeneratorOptions,
): GeneratorArtifact {
  const entities: Record<string, EntitySymbols> = {};
  for (const { namespace, entity } of iterEntities(ir)) {
    entities[`${namespace}.${entity.name}`] = {
      module: entityModule(namespace, entity.name),
      symbols: entitySymbols(entity.name, options),
    };
  }

  const perNamespace: AngularArtifactExtra['perNamespace'] = {};
  for (const namespace of Object.keys(ir.sources)) {
    perNamespace[namespace] = {
      runtimeModule: runtimeModule(namespace),
      barrelModule: barrelModule(namespace),
    };
  }

  const extra: AngularArtifactExtra = {
    forms: options.forms,
    relations: options.relations,
    zodVersion: zodExtra(zod).zodVersion,
    perNamespace,
  };

  const peerDependencies = options.forms.includes('signal')
    ? { '@angular/core': '>=22', '@angular/forms': '>=22' }
    : { '@angular/core': '>=17', '@angular/forms': '>=17' };

  return { entities, peerDependencies, extra };
}
