import { describe, expect, it } from 'vitest';
import { emitRuntime } from './runtime.js';

describe('emitRuntime', () => {
  const text = emitRuntime();

  it('is the only place that imports @tanstack/react-form', () => {
    expect(text).toContain(
      "import { revalidateLogic, useForm } from '@tanstack/react-form';",
    );
    expect(text).toContain(
      "import type { FormOptions, ReactFormExtendedApi, StandardSchemaV1 } from '@tanstack/react-form';",
    );
  });

  it('re-exports StandardSchemaV1 for the entity files', () => {
    expect(text).toContain('export type { StandardSchemaV1 };');
  });

  it('accepts any schema outputting T, whatever its input (z.coerce.date() has an unknown input)', () => {
    expect(text).toContain(
      'export type ZodFormSchema<T> = StandardSchemaV1<unknown, T>;',
    );
    expect(text).toContain('schema: ZodFormSchema<T>;');
  });

  it('exports ZodFormApi, ZodFormConfig and useZodForm', () => {
    expect(text).toContain('export type ZodFormApi<T> = ReactFormExtendedApi<');
    expect(text).toContain('export interface ZodFormConfig<T> {');
    expect(text).toContain(
      'export function useZodForm<T>(config: ZodFormConfig<T>): ZodFormApi<T> {',
    );
  });

  it('binds the schema to the onDynamic validator, submit first then change', () => {
    expect(text).toContain(
      'validators: { onDynamic: config.schema as StandardSchemaV1<T, unknown> },',
    );
    expect(text).toContain("mode: config.validation?.mode ?? 'submit',");
    expect(text).toContain(
      "modeAfterSubmission: config.validation?.modeAfterSubmission ?? 'change',",
    );
  });

  it('is deterministic and ends with one newline', () => {
    expect(emitRuntime()).toBe(text);
    expect(text.endsWith('}\n')).toBe(true);
  });
});
