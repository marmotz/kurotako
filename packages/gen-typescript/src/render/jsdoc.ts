/** Field documentation and constraints -> an optional JSDoc block. */
import type { Field } from '@kurotako/ir';

/** Render documentation-only metadata in a stable, human-readable order. */
export function jsDoc(field: Field): string {
  const tags: string[] = [];
  const constraints = field.constraints;

  if (constraints.min !== undefined) tags.push(`@min ${constraints.min}`);
  if (constraints.max !== undefined) tags.push(`@max ${constraints.max}`);
  if (constraints.minLength !== undefined) {
    tags.push(`@minLength ${constraints.minLength}`);
  }
  if (constraints.maxLength !== undefined) {
    tags.push(`@maxLength ${constraints.maxLength}`);
  }
  if (constraints.regex !== undefined) {
    tags.push(`@pattern ${constraints.regex}`);
  }
  if (constraints.format !== undefined) {
    tags.push(`@format ${constraints.format}`);
  }
  if (constraints.unique) tags.push('@unique');
  if (field.default?.kind === 'value') {
    tags.push(`@default ${JSON.stringify(field.default.value)}`);
  }
  if (field.type.kind === 'unknown') {
    tags.push(
      field.type.hint === undefined
        ? '@see unknown'
        : `@see unknown: ${field.type.hint}`,
    );
  }

  const prose = field.doc?.split('\n') ?? [];
  if (prose.length === 0 && tags.length === 0) {
    return '';
  }

  const lines = [...prose];
  if (prose.length > 0 && tags.length > 0) lines.push('');
  lines.push(...tags);
  return ['/**', ...lines.map((line) => ` * ${line}`), ' */'].join('\n');
}
