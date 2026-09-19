/** This generator's per-namespace barrel. */
import { jsFile } from '@kurotako/core';
import type { SourceIR } from '@kurotako/ir';
import { nonRedundantTypeAliases } from '@kurotako/ir';

/** Re-export every emitted shared and entity declaration module. */
export function emitBarrel(
  source: SourceIR,
  emitsScalars: boolean,
  emitsAliases = nonRedundantTypeAliases(source).length > 0,
): string {
  const lines: string[] = [];
  if (emitsScalars) lines.push(`export type * from '${jsFile('./scalars')}';`);
  lines.push(`export * from '${jsFile('./enums')}';`);
  if (emitsAliases) lines.push(`export type * from '${jsFile('./aliases')}';`);
  if (Object.keys(source.entities).length > 0) {
    lines.push(`export type * from '${jsFile('./filters')}';`);
  }
  for (const entity of Object.values(source.entities)) {
    lines.push(`export type * from '${jsFile(`./${entity.name}.type`)}';`);
  }
  return `${lines.join('\n')}\n`;
}
