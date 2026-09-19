/**
 * `<ns>/zod/index.ts` — this generator's own sub-tree barrel. Re-exports
 * `./enums`, `./filters` (when the source has >= 1 entity), `./aliases` (when
 * the source has >= 1 type alias) and every `./<entity>.schema`. An empty
 * source still yields a valid `index.ts`.
 */
import { jsFile } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import { nonRedundantTypeAliases } from '@kurotako/ir';

export function emitBarrel(source: SourceIR): string {
  const lines = [`export * from '${jsFile('./enums')}';`];

  const entities = Object.values(source.entities);
  if (entities.length > 0) {
    lines.push(`export * from '${jsFile('./filters')}';`);
  }
  if (nonRedundantTypeAliases(source).length > 0) {
    lines.push(`export * from '${jsFile('./aliases')}';`);
  }
  for (const entity of entities) {
    lines.push(`export * from '${jsFile(`./${entity.name}.schema`)}';`);
  }

  return `${lines.join('\n')}\n`;
}
