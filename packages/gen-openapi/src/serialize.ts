/**
 * `OpenApiDocument` -> JSON or YAML string.
 */
import * as YAML from 'yaml';
import type { OpenApiDocument } from './document.js';
import type { OpenApiGeneratorOptions } from './options.js';

export function serialize(
  document: OpenApiDocument,
  format: OpenApiGeneratorOptions['format'],
): string {
  if (format === 'yaml') {
    return YAML.stringify(document);
  }
  return `${JSON.stringify(document, null, 2)}\n`;
}
