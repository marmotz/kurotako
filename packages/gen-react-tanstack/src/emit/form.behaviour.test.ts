// @vitest-environment jsdom
/**
 * Runs the generated hooks for real: the generator output is written to a scratch
 * directory inside this package (so `zod`, `react` and `@tanstack/react-form` resolve
 * from its `node_modules`), imported, and driven with `renderHook`.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useField } from '@tanstack/react-form';
import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import {
  generateFiles,
  relativizeSpecifiers,
  writeFiles,
} from '../testing/generated.js';
import { apiSource, checkoutSource, irOf } from '../testing/ir.js';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

let dir: string;
// biome-ignore lint/suspicious/noExplicitAny: the generated modules are imported dynamically
let login: any;
// biome-ignore lint/suspicious/noExplicitAny: the generated modules are imported dynamically
let loginSchemas: any;
// biome-ignore lint/suspicious/noExplicitAny: the generated modules are imported dynamically
let order: any;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(PACKAGE_ROOT, 'tmp-behaviour-'));
  const ir = irOf(apiSource(), checkoutSource());
  const files = relativizeSpecifiers(
    await generateFiles(ir, { relations: 'deep' }),
    ['api', 'checkout'],
  );
  await writeFiles(dir, files);
  login = await import(
    /* @vite-ignore */ path.join(dir, 'api/react-tanstack/LoginDto.form.ts')
  );
  loginSchemas = await import(
    /* @vite-ignore */ path.join(
      dir,
      'api/react-tanstack/zod/LoginDto.schema.ts',
    )
  );
  order = await import(
    /* @vite-ignore */ path.join(dir, 'checkout/react-tanstack/Order.form.ts')
  );
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const VALID = { email: 'a@b.co', password: 'longenough' };

interface FieldErrors {
  email: unknown[];
  password: unknown[];
}

/** Mounts `useLoginDtoForm` with its two fields registered, exposing the errors. */
function mount(options: Record<string, unknown> = {}) {
  return renderHook(() => {
    const form = login.useLoginDtoForm(options);
    const email = useField({ form, name: 'email' });
    const password = useField({ form, name: 'password' });
    const errors: FieldErrors = {
      email: email.state.meta.errors,
      password: password.state.meta.errors,
    };
    return { form, email, password, errors };
  });
}

const messages = (errors: unknown[]): string[] =>
  errors.map((e) =>
    typeof e === 'string' ? e : String((e as { message?: string }).message),
  );

describe('generated useXxxForm hook', () => {
  it('starts from the generated default values, overridable per field', () => {
    const { result } = mount({ defaultValues: { email: 'x@y.zz' } });
    expect(result.current.form.state.values).toEqual({
      email: 'x@y.zz',
      password: '',
    });
  });

  it('an invalid submit puts the Zod issue on the matching field and skips onSubmit', async () => {
    const onSubmit = vi.fn();
    const onSubmitInvalid = vi.fn();
    const { result } = mount({ onSubmit, onSubmitInvalid });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(result.current.errors.email.length).toBeGreaterThan(0);
    expect(result.current.errors.password.length).toBeGreaterThan(0);
    expect(messages(result.current.errors.email).join(' ')).toMatch(/email/i);
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
  });

  it('only the invalid field carries an error', async () => {
    const { result } = mount({ defaultValues: { email: VALID.email } });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(result.current.errors.email).toEqual([]);
    expect(result.current.errors.password.length).toBeGreaterThan(0);
  });

  it('a valid submit calls onSubmit with the values', async () => {
    const onSubmit = vi.fn();
    const { result } = mount({ defaultValues: VALID, onSubmit });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0].value).toEqual(VALID);
  });

  it('validates on submit first, then on change', async () => {
    const { result } = mount({ defaultValues: VALID });
    // Before the first submit, an invalid change is not validated.
    await act(async () => {
      result.current.email.handleChange('not-an-email');
    });
    expect(result.current.errors.email).toEqual([]);

    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(result.current.errors.email.length).toBeGreaterThan(0);

    // After it, a change revalidates and clears the error.
    await act(async () => {
      result.current.email.handleChange('ok@example.com');
    });
    expect(result.current.errors.email).toEqual([]);

    await act(async () => {
      result.current.email.handleChange('broken');
    });
    expect(result.current.errors.email.length).toBeGreaterThan(0);
  });

  it('the validation option changes when it runs', async () => {
    const { result } = mount({
      defaultValues: VALID,
      validation: { mode: 'change' },
    });
    await act(async () => {
      result.current.email.handleChange('not-an-email');
    });
    expect(result.current.errors.email.length).toBeGreaterThan(0);
  });

  it('a call-site schema replaces the generated one', async () => {
    const refined = loginSchemas.LoginDtoSchema.refine(
      (v: { password: string }) => !v.password.startsWith('forbidden'),
      { message: 'password is too common', path: ['password'] },
    );
    const onSubmit = vi.fn();
    const { result } = mount({
      defaultValues: { email: VALID.email, password: 'forbidden-one' },
      schema: refined,
      onSubmit,
    });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    // Valid for the generated schema, rejected by the refined one.
    expect(
      loginSchemas.LoginDtoSchema.safeParse(result.current.form.state.values)
        .success,
    ).toBe(true);
    expect(messages(result.current.errors.password)).toContain(
      'password is too common',
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('a call-site extended schema is honoured', async () => {
    const extended = loginSchemas.LoginDtoSchema.extend({
      remember: z.literal(true),
    });
    const onSubmit = vi.fn();
    const { result } = mount({
      defaultValues: VALID,
      schema: extended,
      onSubmit,
    });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    // `remember` is not a form value, so the extended schema rejects the submit.
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('setErrorMap shows a server error on a field', async () => {
    const { result } = mount({ defaultValues: VALID });
    await act(async () => {
      result.current.form.setErrorMap({
        onSubmit: { fields: { email: 'already used' } },
      });
    });
    expect(messages(result.current.errors.email)).toContain('already used');
  });

  it('a server error set from onSubmit stays on the field after the submit', async () => {
    const { result } = mount({
      defaultValues: VALID,
      onSubmit: ({
        formApi,
      }: {
        formApi: { setErrorMap: (m: unknown) => void };
      }) => {
        formApi.setErrorMap({
          onSubmit: { fields: { email: 'already used' } },
        });
      },
    });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(messages(result.current.errors.email)).toContain('already used');
  });

  it('deep mode: a Zod issue on a nested to-one path lands on the nested field', async () => {
    const { result } = renderHook(() => {
      const form = order.useOrderForm({
        defaultValues: { number: 'ORD-1', customer: { name: 'x' } },
      });
      const customerName = useField({ form, name: 'customer.name' });
      const number = useField({ form, name: 'number' });
      return { form, customerName, number };
    });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(
      result.current.customerName.state.meta.errors.length,
    ).toBeGreaterThan(0);
    expect(result.current.number.state.meta.errors).toEqual([]);
  });

  it('deep mode: a Zod issue in a to-many item lands on the indexed path', async () => {
    const { result } = renderHook(() => {
      const form = order.useOrderForm({
        defaultValues: {
          number: 'ORD-1',
          customer: { name: 'Ada' },
          lines: [
            { sku: 'AB', qty: 1 },
            { sku: '', qty: 1 },
          ],
        },
      });
      const first = useField({ form, name: 'lines[0].sku' });
      const second = useField({ form, name: 'lines[1].sku' });
      return { form, first, second };
    });
    await act(async () => {
      await result.current.form.handleSubmit();
    });
    expect(result.current.first.state.meta.errors).toEqual([]);
    expect(result.current.second.state.meta.errors.length).toBeGreaterThan(0);
  });

  it('deep mode: the nested to-one default comes from the target entity', () => {
    const { result } = renderHook(() => order.useOrderForm());
    expect(result.current.state.values).toEqual({
      number: '',
      customer: { name: '' },
      lines: [],
    });
  });
});
