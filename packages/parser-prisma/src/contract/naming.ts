import { PrismaEntityCollisionError } from '../errors.js';
import type { PrismaParserOptions } from '../options.js';

export interface ContractModelName {
  namespace: string;
  name: string;
}

export function resolveNames(
  models: readonly ContractModelName[],
  options: Pick<PrismaParserOptions, 'namespacePrefix' | 'rename'>,
): Map<string, string> {
  const names = new Map<string, string>();
  const collisions = new Map<string, string[]>();
  for (const { namespace, name } of models) {
    const key = `${namespace}.${name}`;
    const target =
      options.rename?.[key] ??
      `${options.namespacePrefix?.[namespace] ?? ''}${name}`;
    names.set(key, target);
    const entries = collisions.get(target) ?? [];
    entries.push(key);
    collisions.set(target, entries);
  }
  for (const [target, modelsForTarget] of collisions) {
    if (modelsForTarget.length > 1) {
      throw new PrismaEntityCollisionError(target, modelsForTarget);
    }
  }
  return names;
}
