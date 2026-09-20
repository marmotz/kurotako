/**
 * `<ns>/react-tanstack/index.ts` — this generator's own sub-tree barrel. Re-exports
 * `./form.runtime` (when emitted) and every emitted `./<entity>.form`. A namespace
 * with no emitted entity still yields a valid (empty) module.
 */
import { jsFile } from '@kurotako/core';

export function emitBarrel(entities: readonly string[]): string {
  if (entities.length === 0) {
    return 'export {};\n';
  }
  const lines = [`export * from '${jsFile('./form.runtime')}';`];
  for (const entity of entities) {
    lines.push(`export * from '${jsFile(`./${entity}.form`)}';`);
  }
  return `${lines.join('\n')}\n`;
}
