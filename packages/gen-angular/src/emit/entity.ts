/**
 * One entity -> `<ns>/angular/<entity>.form.ts` source text: a sorted import
 * block, then the reactive block (control-tree interfaces + `@Injectable`
 * factory, when `forms` includes `'reactive'`) and the Signal Forms block
 * (schema + model factory, when `forms` includes `'signal'`)
 * (`generator-angular/technical.md` §File layout).
 */
import type { GeneratorArtifact, Logger } from '@kurotako/core';
import type { Entity, SourceIR } from '@kurotako/ir';
import type { AngularGeneratorOptions } from '../options.js';
import { ImportsRecorder } from '../render/imports.js';
import { reactiveEntity } from '../render/reactive.js';
import { signalEntity } from '../render/signal.js';

export function emitEntity(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  logger?: Logger,
): string {
  const imports = new ImportsRecorder();
  const blocks: string[] = [];

  if (options.forms.includes('reactive')) {
    blocks.push(
      reactiveEntity(entity, namespace, source, options, zod, imports, logger),
    );
  }
  if (options.forms.includes('signal')) {
    blocks.push(
      signalEntity(entity, namespace, source, options, zod, imports, logger),
    );
  }

  const importBlock = imports.render();
  return `${[importBlock, '', ...blocks].join('\n').trimEnd()}\n`;
}
