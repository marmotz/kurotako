/**
 * `mergeSources` — turn the per-source `SourceIR`s produced by the parsers into
 * the single global `IR`. Merge and the duplicate-namespace policy are
 * orchestration concerns, left to this package by `@kurotako/ir`
 * (`ir-model/technical.md` §Out of scope here).
 */

import type { IR, SourceIR } from '@kurotako/ir';
import { IR_VERSION, validateIR, validateSourceIR } from '@kurotako/ir';
import {
  DuplicateNamespaceError,
  IrValidationError,
  NamespaceMismatchError,
} from './errors.js';
import type { Logger } from './types.js';

export interface MergeEntry {
  namespace: string;
  sourceIR: SourceIR;
}

/**
 * Build `{ irVersion, sources }` from `entries`, inserting each `SourceIR` under
 * its namespace in input order. Rejects a namespace mismatch, a per-source
 * validation failure, a duplicate namespace, and a post-merge cross-source
 * coherence failure. Non-fatal observations from the post-merge validation
 * `info` channel (`union_cycle`, `degenerate_union`) are logged at `warn`.
 */
export function mergeSources(entries: MergeEntry[], logger?: Logger): IR {
  const sources: Record<string, SourceIR> = {};

  for (const { namespace, sourceIR } of entries) {
    if (sourceIR.namespace !== namespace) {
      throw new NamespaceMismatchError(namespace, sourceIR.namespace);
    }

    const validation = validateSourceIR(sourceIR);
    if (!validation.ok) {
      throw new IrValidationError(validation.issues, namespace);
    }

    if (namespace in sources) {
      throw new DuplicateNamespaceError(namespace);
    }
    sources[namespace] = validation.value;
  }

  const ir: IR = { irVersion: IR_VERSION, sources };

  const result = validateIR(ir);
  if (!result.ok) {
    throw new IrValidationError(result.issues);
  }
  for (const note of result.info ?? []) {
    logger?.warn(
      `IR ${note.code} at ${note.path === '' ? '<root>' : note.path}: ${note.message}`,
    );
  }

  return result.value;
}
