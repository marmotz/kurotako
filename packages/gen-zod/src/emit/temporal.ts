/**
 * `<ns>/zod/temporal.ts` — the Zod schemas for `dateType: 'temporal'`.
 *
 * Each schema accepts an ISO 8601 string (an HTTP body) or an existing Temporal
 * object (an ORM row) and outputs the Temporal object. The global `Temporal` is
 * only touched while parsing, never at import time, so a module that merely
 * imports these schemas still loads where `Temporal` is not defined yet.
 */
import { TEMPORAL_SCHEMA_NAMES } from '../dialect.js';

const NAMES = Object.values(TEMPORAL_SCHEMA_NAMES);

/** The helper identifiers a piece of generated source refers to, sorted. */
export function temporalHelpersUsed(content: string): string[] {
  return NAMES.filter((name) =>
    new RegExp(`\\b${name}\\b`).test(content),
  ).sort();
}

/**
 * Add `import { … } from './temporal.js'` to a generated file that refers to the
 * helpers, right after its `zod` import. Returns the content unchanged otherwise.
 */
export function withTemporalImport(content: string, spec: string): string {
  const used = temporalHelpersUsed(content);
  if (used.length === 0) {
    return content;
  }
  const zodImport = "import { z } from 'zod';\n";
  const at = content.indexOf(zodImport);
  const statement = `import { ${used.join(', ')} } from '${spec}';\n`;
  return at === -1
    ? `${statement}${content}`
    : `${content.slice(0, at + zodImport.length)}${statement}${content.slice(at + zodImport.length)}`;
}

const CLASSES = [
  ['Instant', 'an ISO 8601 instant'],
  ['PlainDate', 'an ISO 8601 date'],
  ['PlainTime', 'an ISO 8601 time'],
] as const;

export function emitTemporal(): string {
  const blocks = CLASSES.map(
    ([
      cls,
      label,
    ]) => `export const ${TEMPORAL_SCHEMA_NAMES[cls]} = z.preprocess(
  parseWith((value) => Temporal.${cls}.from(value)),
  z.custom<Temporal.${cls}>(
    (value) => value instanceof Temporal.${cls},
    'Expected ${label} or a Temporal.${cls}',
  ),
);`,
  );
  return `${[
    "import { z } from 'zod';",
    '',
    `// A string that is not valid ISO 8601 is passed through unchanged, so the
// \`z.custom\` check reports it as a validation issue instead of throwing.
function parseWith(parse: (value: string) => unknown) {
  return (value: unknown): unknown => {
    if (typeof value !== 'string') {
      return value;
    }
    try {
      return parse(value);
    } catch {
      return value;
    }
  };
}`,
    '',
    ...blocks.flatMap((block) => [block, '']),
  ]
    .join('\n')
    .trimEnd()}\n`;
}
