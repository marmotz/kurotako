/**
 * `<ns>/angular/index.ts` — this generator's own sub-tree barrel. Re-exports
 * `./zod-forms.runtime` (when emitted) and every `./<entity>.form`. A
 * zero-entity source still yields a valid `index.ts`.
 */
import type { SourceIR } from '@kurotako/ir';
import type { AngularGeneratorOptions } from '../options.js';

export function emitBarrel(
  source: SourceIR,
  options: AngularGeneratorOptions,
): string {
  const lines: string[] = [];
  const entities = Object.values(source.entities);

  if (entities.length > 0 && options.forms.length > 0) {
    lines.push("export * from './zod-forms.runtime';");
  }
  for (const entity of entities) {
    lines.push(`export * from './${entity.name}.form';`);
  }

  return `${lines.join('\n')}\n`;
}
