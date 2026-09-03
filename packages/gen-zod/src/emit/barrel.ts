/**
 * `<ns>/zod/index.ts` — this generator's own sub-tree barrel. Re-exports
 * `./enums`, `./filters` (when the source has >= 1 entity) and every
 * `./<entity>.schema`. An empty source still yields a valid `index.ts`.
 */
import type { SourceIR } from '@kurotako/ir';

export function emitBarrel(source: SourceIR): string {
  const lines = ["export * from './enums';"];

  const entities = Object.values(source.entities);
  if (entities.length > 0) {
    lines.push("export * from './filters';");
  }
  for (const entity of entities) {
    lines.push(`export * from './${entity.name}.schema';`);
  }

  return `${lines.join('\n')}\n`;
}
