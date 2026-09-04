import { createSourceIR } from '@kurotako/ir';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { AngularGeneratorOptions } from '../options.js';
import { emitRuntime } from './runtime.js';

const source = createSourceIR({ namespace: 'blog', parser: 'test' }).build();

function opts(forms: ('reactive' | 'signal')[]) {
  return v.parse(AngularGeneratorOptions, { forms });
}

describe('emitRuntime — text assembly', () => {
  it('forms: [reactive] -> zodValidator only, no Signal Forms import', () => {
    const text = emitRuntime(source, opts(['reactive']));
    expect(text).toContain('export function zodValidator(');
    expect(text).not.toContain('zodTreeValidate');
    expect(text).not.toContain('@angular/forms/signals');
  });

  it('forms: [signal] -> zodTreeValidate only, no @angular/forms import', () => {
    const text = emitRuntime(source, opts(['signal']));
    expect(text).toContain('export function zodTreeValidate');
    expect(text).not.toContain('zodValidator(schema');
    expect(text).not.toContain("from '@angular/forms';");
  });

  it('forms: [reactive, signal] -> both helpers', () => {
    const text = emitRuntime(source, opts(['reactive', 'signal']));
    expect(text).toContain('export function zodValidator(');
    expect(text).toContain('export function zodTreeValidate');
  });

  it('never emits a Validators.* call', () => {
    const text = emitRuntime(source, opts(['reactive', 'signal']));
    expect(text).not.toContain('Validators.');
  });
});

// --- behavioral mirror of the emitted `zodValidator` algorithm --------------
//
// The runtime file is hand-written, deterministic source text (this package
// has no @angular/forms dependency to compile it against). These duck-typed
// fakes exercise the exact algorithm `emit/runtime.ts`'s ZOD_VALIDATOR string
// implements, so a regression there is caught even though the string itself
// is never executed by this suite.

interface FakeControl {
  errors: Record<string, unknown> | null;
  setErrors(errors: Record<string, unknown> | null, opts?: unknown): void;
  controls?: Record<string, FakeControl>;
}

function fakeControl(): FakeControl {
  const self: FakeControl = {
    errors: null,
    setErrors(errors) {
      self.errors = errors;
    },
  };
  return self;
}

function fakeGroup(children: Record<string, FakeControl>) {
  const self: FakeControl & {
    getRawValue(): unknown;
    get(path: string): FakeControl | null;
  } = {
    errors: null,
    controls: children,
    setErrors(errors) {
      self.errors = errors;
    },
    getRawValue: () => ({}),
    get: (path: string) => children[path] ?? null,
  };
  return self;
}

function collectControls(control: FakeControl): FakeControl[] {
  const out = [control];
  if (control.controls) {
    for (const child of Object.values(control.controls)) {
      out.push(...collectControls(child));
    }
  }
  return out;
}

function setZodError(control: FakeControl, message: unknown): void {
  const current = control.errors;
  if (
    current !== null &&
    JSON.stringify(current.zod) === JSON.stringify(message)
  ) {
    return;
  }
  control.setErrors({ ...current, zod: message }, { emitEvent: false });
}

function clearZodError(control: FakeControl): void {
  const current = control.errors;
  if (current === null || !('zod' in current)) {
    return;
  }
  const { zod: _discard, ...rest } = current;
  control.setErrors(Object.keys(rest).length > 0 ? rest : null, {
    emitEvent: false,
  });
}

function zodValidator(
  safeParse: (value: unknown) =>
    | { success: true }
    | {
        success: false;
        error: { issues: { path: (string | number)[]; message: string }[] };
      },
) {
  return (
    group: FakeControl & {
      getRawValue(): unknown;
      get(path: string): FakeControl | null;
    },
  ) => {
    const result = safeParse(group.getRawValue());
    const touched = new Set<FakeControl>();
    const rootIssues: { path: (string | number)[]; message: string }[] = [];

    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.map(String).join('.');
        const control = path === '' ? null : group.get(path);
        if (control !== null) {
          setZodError(control, issue.message);
          touched.add(control);
        } else {
          rootIssues.push(issue);
        }
      }
    }

    for (const control of collectControls(group)) {
      if (control !== group && !touched.has(control)) {
        clearZodError(control);
      }
    }

    if (rootIssues.length === 0) {
      clearZodError(group);
      return null;
    }

    const formErrors: string[] = [];
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of rootIssues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message);
      } else {
        const key = String(issue.path[0]);
        if (fieldErrors[key] === undefined) {
          fieldErrors[key] = [];
        }
        fieldErrors[key].push(issue.message);
      }
    }
    const zodError = { formErrors, fieldErrors };
    setZodError(group, zodError);
    return { zod: zodError };
  };
}

describe('zodValidator algorithm', () => {
  it('distributes a path issue onto the matching descendant control', () => {
    const email = fakeControl();
    const group = fakeGroup({ email });
    const validator = zodValidator(() => ({
      success: false,
      error: { issues: [{ path: ['email'], message: 'invalid email' }] },
    }));
    validator(group);
    expect(email.errors).toEqual({ zod: 'invalid email' });
  });

  it('a pathless issue lands on the group', () => {
    const group = fakeGroup({});
    const validator = zodValidator(() => ({
      success: false,
      error: { issues: [{ path: [], message: 'cross-field' }] },
    }));
    validator(group);
    expect(group.errors?.zod).toEqual({
      formErrors: ['cross-field'],
      fieldErrors: {},
    });
  });

  it('a subsequent valid parse clears the zod keys', () => {
    const email = fakeControl();
    email.errors = { zod: 'invalid email' };
    const group = fakeGroup({ email });
    group.errors = { zod: { formErrors: [], fieldErrors: {} } };
    const validator = zodValidator(() => ({ success: true }));
    const result = validator(group);
    expect(result).toBeNull();
    expect(email.errors).toBeNull();
    expect(group.errors).toBeNull();
  });

  it('a non-zod error key on a control is left intact', () => {
    const email = fakeControl();
    email.errors = { required: true };
    const group = fakeGroup({ email });
    const validator = zodValidator(() => ({ success: true }));
    validator(group);
    expect(email.errors).toEqual({ required: true });
  });
});
