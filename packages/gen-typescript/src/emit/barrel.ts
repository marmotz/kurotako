/** This generator's per-namespace barrel. */
import type { SourceIR } from '@kurotako/ir';

/** Re-export every emitted shared and entity declaration module. */
export function emitBarrel(
  source: SourceIR,
  emitsScalars: boolean,
  emitsAliases = Object.keys(source.typeAliases ?? {}).length > 0,
): string {
  const lines: string[] = [];
  if (emitsScalars) lines.push("export type * from './scalars';");
  lines.push("export * from './enums';");
  if (emitsAliases) lines.push("export type * from './aliases';");
  if (Object.keys(source.entities).length > 0) {
    lines.push("export type * from './filters';");
  }
  for (const entity of Object.values(source.entities)) {
    lines.push(`export type * from './${entity.name}.type';`);
  }
  return `${lines.join('\n')}\n`;
}
