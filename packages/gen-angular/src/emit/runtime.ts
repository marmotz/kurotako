/**
 * `<ns>/angular/zod-forms.runtime.ts` — hand-written, deterministic source (no
 * per-entity content). Emitted once per namespace whenever the source has >= 1
 * entity and `forms` is non-empty (`generator-angular/technical.md` §File
 * layout).
 *
 * `zodValidator` (reactive half): a group-level `ValidatorFn` that
 * `safeParse`s against the Zod schema and distributes each issue onto the
 * matching descendant control by `issue.path`, clearing stale `zod` keys and
 * guarding against a `setErrors`-triggered validation loop
 * (`generator-angular/technical.md` §`zodValidator`).
 *
 * `zodTreeValidate` (Signal Forms half): wraps `@angular/forms/signals`'
 * tree-level validator primitive. This is the *only* file (besides
 * `render/signal.ts`) referencing that experimental surface, so a secondary-API
 * shift on a future Angular minor is a single-file update
 * (`generator-angular/technical.md` §Signal Forms schema + model factory).
 */
import type { SourceIR } from '@kurotako/ir';
import type { AngularGeneratorOptions } from '../options.js';

const ZOD_VALIDATOR = `export function zodValidator(schema: ZodType): ValidatorFn {
  return (group: AbstractControl) => {
    const result = schema.safeParse(group.getRawValue());
    const touched = new Set<AbstractControl>();
    const rootIssues: { path: (string | number)[]; message: string }[] = [];

    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path.map(String).join('.');
        const control = path === '' ? null : group.get(path);
        if (control !== null && control !== undefined) {
          setZodError(control, issue.message);
          touched.add(control);
        } else {
          rootIssues.push({ path: issue.path as (string | number)[], message: issue.message });
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
        (fieldErrors[key] ??= []).push(issue.message);
      }
    }

    const zodError = { formErrors, fieldErrors };
    setZodError(group, zodError);
    return { zod: zodError };
  };
}

function setZodError(control: AbstractControl, message: unknown): void {
  const current = control.errors;
  if (current !== null && sameZodError(current.zod, message)) {
    return;
  }
  control.setErrors({ ...current, zod: message }, { emitEvent: false });
}

function clearZodError(control: AbstractControl): void {
  const current = control.errors;
  if (current === null || current === undefined || !('zod' in current)) {
    return;
  }
  const { zod: _discard, ...rest } = current;
  control.setErrors(Object.keys(rest).length > 0 ? rest : null, {
    emitEvent: false,
  });
}

function sameZodError(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function collectControls(control: AbstractControl): AbstractControl[] {
  const out: AbstractControl[] = [control];
  const children = (control as { controls?: unknown }).controls;
  if (children !== null && typeof children === 'object') {
    for (const child of Object.values(children as Record<string, AbstractControl>)) {
      out.push(...collectControls(child));
    }
  }
  return out;
}`;

const ZOD_TREE_VALIDATE = `export function zodTreeValidate<T>(
  path: SchemaPath<T>,
  schema: ZodType<T>,
): void {
  validateTree(path, (ctx) => {
    const result = schema.safeParse(ctx.value());
    if (result.success) {
      return undefined;
    }
    return result.error.issues.map((issue) => ({
      kind: 'custom' as const,
      message: issue.message,
      // Dynamically walked from the Zod issue path against the field tree's
      // runtime shape; ValidationError.fieldTree accepts undefined for a
      // pathless issue, so a same-shaped object (rather than branching on
      // whether one was found) keeps this a single, uniform return type.
      fieldTree: resolveFieldTree(ctx.fieldTree, issue.path) as
        | ReadonlyFieldTree<unknown>
        | undefined,
    }));
  });
}

function resolveFieldTree(root: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((node, key) => {
    if (node === null || typeof node !== 'object') {
      return undefined;
    }
    return (node as Record<PropertyKey, unknown>)[key];
  }, root);
}`;

export function emitRuntime(
  _source: SourceIR,
  options: AngularGeneratorOptions,
): string {
  const reactive = options.forms.includes('reactive');
  const signal = options.forms.includes('signal');

  const imports: string[] = [];
  if (reactive) {
    imports.push(
      "import type { AbstractControl, ValidatorFn } from '@angular/forms';",
    );
  }
  if (signal) {
    imports.push(
      "import type { ReadonlyFieldTree, SchemaPath } from '@angular/forms/signals';",
      "import { validateTree } from '@angular/forms/signals';",
    );
  }
  imports.push("import type { ZodType } from 'zod';");

  const blocks: string[] = [];
  if (reactive) {
    blocks.push(ZOD_VALIDATOR);
  }
  if (signal) {
    blocks.push(ZOD_TREE_VALIDATE);
  }

  return `${[imports.join('\n'), '', ...blocks].join('\n').trimEnd()}\n`;
}
