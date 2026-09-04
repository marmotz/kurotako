/**
 * Minimal ambient `.d.ts` stubs for `@angular/core`, `@angular/forms` (+ its
 * `./signals` subpath) and `zod`, used only by `emit/runtime.compile.test.ts`
 * to real-compile generated output. Not part of the published surface.
 *
 * This package has no runtime dependency on Angular or Zod (the generator
 * only emits source text for the *consuming* project to compile), so there is
 * no other way to catch a drift against the real `@angular/forms/signals`
 * API surface — the exact bug class this package hit once already (guessed
 * `FieldPath` / `ctx.field` that don't exist on the real types). These stubs
 * were transcribed from `@angular/forms@22`'s actual `types/signals.d.ts` /
 * `types/forms.d.ts` (verified by hand against a real install) — keep them in
 * sync if a future Angular minor changes the shapes used here
 * (`RootFieldContext`, `SchemaPath`, `TreeValidator`, `ValidationError`,
 * `FieldTree`, `form`, `schema`, `validateTree`).
 */

export const ANGULAR_CORE_DTS = `
export declare function Injectable(opts?: unknown): ClassDecorator;
export declare function signal<T>(value: T): WritableSignal<T>;
export interface Signal<T> {
  (): T;
}
export interface WritableSignal<T> extends Signal<T> {
  set(value: T): void;
  update(fn: (value: T) => T): void;
}
`;

export const ANGULAR_FORMS_DTS = `
export declare class AbstractControl<T = unknown> {
  errors: Record<string, unknown> | null;
  setErrors(errors: Record<string, unknown> | null, opts?: { emitEvent?: boolean }): void;
  getRawValue(): unknown;
  get(path: string): AbstractControl | null;
  controls?: unknown;
}
export declare type ValidatorFn = (control: AbstractControl) => Record<string, unknown> | null;
export declare class FormControl<T = unknown> extends AbstractControl<T> {
  constructor(value: T, opts?: { nonNullable?: boolean } | unknown);
  value: T;
}
export declare class FormGroup<
  TControl extends { [K in keyof TControl]: AbstractControl<unknown> } = Record<string, AbstractControl>,
> extends AbstractControl<TControl> {
  constructor(controls: TControl, opts?: { validators?: ValidatorFn[] });
  controls: TControl;
  addControl(name: string, control: AbstractControl): void;
}
export declare class FormArray<TItem extends AbstractControl = AbstractControl> extends AbstractControl<TItem[]> {
  constructor(controls: TItem[]);
  controls: TItem[];
  push(control: TItem): void;
}
`;

export const ANGULAR_FORMS_SIGNALS_DTS = `
import type { Signal, WritableSignal } from '@angular/core';

export declare enum PathKind {
  Root = 0,
  Child = 1,
  Item = 2,
}
export declare enum SchemaPathRules {
  Supported = 1,
  Unsupported = 2,
}
export type SchemaPath<
  TValue,
  TSupportsRules extends SchemaPathRules = SchemaPathRules.Supported,
  TPathKind extends PathKind = PathKind.Root,
> = { __schemaPathBrand?: [TValue, TSupportsRules, TPathKind] };
export type SchemaPathTree<TModel, TPathKind extends PathKind = PathKind.Root> = SchemaPath<
  TModel,
  SchemaPathRules.Supported,
  TPathKind
>;
export type SchemaFn<TModel, TPathKind extends PathKind = PathKind.Root> = (
  p: SchemaPathTree<TModel, TPathKind>,
) => void;
export interface Schema<TModel> {
  __schemaBrand?: TModel;
}
export declare function schema<TValue>(fn: SchemaFn<TValue>): Schema<TValue>;

// Simplified vs. the real (deeply mapped, per-key) FieldTree: this package's
// generated code only ever treats a FieldTree as an opaque value (returned,
// passed through, or walked dynamically via a Record<PropertyKey, unknown>
// cast in zodTreeValidate) — it never indexes into it by a statically known
// key, so a nominal-ish brand is enough and avoids a real risk with the full
// per-key mapped type: instantiating it over a primitive-typed field
// (FieldTree<string> mapping over keyof string) risks TS2589 "excessively
// deep and possibly infinite" instantiation.
export type FieldTree<TModel> = { __fieldTreeBrand?: TModel } & (() => {
  value: Signal<TModel>;
});
export declare function form<TModel>(
  model: WritableSignal<TModel>,
  schemaOrOptions?: Schema<TModel> | SchemaFn<TModel>,
): FieldTree<TModel>;

export declare namespace ValidationError {
  interface WithOptionalFieldTree extends ValidationErrorBase {
    readonly fieldTree?: ReadonlyFieldTree<unknown>;
  }
}
interface ValidationErrorBase {
  readonly kind: string;
  readonly message?: string;
}
export type ValidationError = ValidationErrorBase;
export type ValidationSuccess = null | undefined | void;
export type OneOrMany<T> = T | readonly T[];
export type TreeValidationResult<
  E extends ValidationError.WithOptionalFieldTree = ValidationError.WithOptionalFieldTree,
> = ValidationSuccess | OneOrMany<E>;
export type ReadonlyFieldTree<TModel> = FieldTree<TModel>;
export interface RootFieldContext<TValue> {
  readonly value: Signal<TValue>;
  readonly fieldTree: ReadonlyFieldTree<TValue>;
  readonly pathKeys: Signal<readonly string[]>;
}
export type FieldContext<TValue, TPathKind extends PathKind = PathKind.Root> = RootFieldContext<TValue>;
export type LogicFn<TValue, TReturn, TPathKind extends PathKind = PathKind.Root> = (
  ctx: FieldContext<TValue, TPathKind>,
) => TReturn;
export type TreeValidator<TValue, TPathKind extends PathKind = PathKind.Root> = LogicFn<
  TValue,
  TreeValidationResult,
  TPathKind
>;
export declare function validateTree<TValue, TPathKind extends PathKind = PathKind.Root>(
  path: SchemaPath<TValue, SchemaPathRules.Supported, TPathKind>,
  logic: TreeValidator<TValue, TPathKind>,
): void;
`;

/**
 * A minimal but structurally-real Zod v4 stub — enough for `gen-zod`'s own
 * emitted output (\`z.object\`, \`z.string()\`, \`.extend\`, \`.partial()\`,
 * \`z.lazy\`, \`z.infer\`, ...) to real-compile too, since Angular's generated
 * files import gen-zod's schemas and types.
 */
export const ZOD_DTS = `
export declare class ZodType<T = unknown> {
  optional(): ZodType<T | undefined>;
  nullable(): ZodType<T | null>;
  default(v: T): ZodType<T>;
  partial(): ZodType<Partial<T>>;
  extend<U extends Record<string, ZodType<unknown>>>(
    shape: U,
  ): ZodType<T & { [K in keyof U]: U[K] extends ZodType<infer V> ? V : never }>;
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: ZodError };
}
export declare class ZodError {
  issues: { path: (string | number)[]; message: string }[];
}
export declare const z: {
  object<U extends Record<string, ZodType<unknown>>>(
    shape: U,
  ): ZodType<{ [K in keyof U]: U[K] extends ZodType<infer V> ? V : never }>;
  string(): ZodType<string>;
  int(): ZodType<number>;
  number(): ZodType<number>;
  boolean(): ZodType<boolean>;
  bigint(): ZodType<bigint>;
  uuid(): ZodType<string>;
  unknown(): ZodType<unknown>;
  coerce: { date(): ZodType<Date> };
  enum<T extends readonly [string, ...string[]]>(values: T): ZodType<T[number]>;
  array<T>(t: ZodType<T>): ZodType<T[]>;
  union<T extends ZodType<unknown>[]>(
    types: T,
  ): ZodType<T[number] extends ZodType<infer V> ? V : never>;
  lazy<T>(fn: () => ZodType<T>): ZodType<T>;
};
export declare namespace z {
  export type infer<T> = T extends ZodType<infer U> ? U : never;
}
`;
