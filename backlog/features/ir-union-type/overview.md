# IR union type

**Status**: technical design — [technical.md](technical.md)

## Context

The IR ([`docs/ir.md`](../../../docs/ir.md), package `@kurotako/ir`) models an entity as a
flat list of fields, each carrying exactly one `FieldType` (`scalar` / `enum` /
`unknown`), plus relations. It cannot express "this value is one of several shapes".
`parser-openapi` needs it: OpenAPI / JSON Schema `oneOf` / `anyOf` appear both on a single
property and as the whole definition of a named schema. Without a union type the parser
falls back to `unknown`, losing every variant for all downstream generators.

`@kurotako/ir` is implemented (archived [ir-model](../../_archives/features/ir-model/overview.md));
`gen-zod` and `gen-angular` are implemented too. This feature is an evolution of all
three.

## Goal

Let an IR value be a union of known variants, at two levels — property-level (a `Field`
whose type is a union) and root-level (a named schema that *is* a union, with no fields of
its own) — and have every v1 generator handle the new shape.

## Décisions actées

- **`FieldType` gains a `union` variant**: `{ kind: 'union'; variants: FieldType[];
  discriminator?: { propertyName: string; mapping?: Record<string, string> } }`. Variants
  are flattened (no union-of-union). `discriminator` is optional and lets `gen-zod` emit
  `z.discriminatedUnion` and `gen-angular` pick the active sub-form.
- **New `FieldType` `ref` variant**: `{ kind: 'ref'; ref: string }` — designates an
  `Entity` or a `TypeAlias` in the **same source**. Resolved in the cross-reference pass.
  Usable as a union variant and as a nested field type. It coexists with `Relation`:
  `parser-openapi` keeps emitting `Relation` for plain 1-1 / 1-n `$ref`, and uses
  `ref` only where `Relation` cannot apply (union variants, alias targets).
- **Root-level unions** live in a new `SourceIR.typeAliases: Record<string, TypeAlias>`
  registry, separate from `entities`. `TypeAlias = { name: string; type: FieldType;
  doc?: string }`. Generators emit a type alias (`export type Payment = …`) plus a
  validation schema for each, never an entity / form.
- **Scope in v1**: `ref` and union variants target the **same namespace only**.
  Cross-source is deferred (consistent with one OpenAPI document = one namespace, and with
  how `Relation` treats cross-source today).
- **Recursion allowed**: self-referential unions / refs / aliases (`Tree = Leaf |
  Tree[]`, mutual references) are valid. The cross-reference pass detects cycles for
  reporting but does not reject them. `gen-zod` uses `z.lazy`; `gen-typescript` is
  trivial; `gen-angular` falls back to a free control on the recursive branch.
- **Generator contract**: handling the union type is **mandatory** for a generator to be
  v1-complete. `gen-zod` and `gen-angular` both gain real support (no `unknown` fallback,
  except `gen-angular` on a recursive branch).
- **`IR_VERSION` bump** to `'2'`; `isCompatible` stays strict equality, so every
  `@kurotako/*` package is rebuilt together (monorepo, acceptable). `nullable` is **not**
  modelled as a union — OpenAPI 3.0 `nullable` / 3.1 `type: [T,"null"]` still normalise to
  `Field.nullable`.

## Open questions

- Exact `TypeAlias` surface and whether an alias may also be a non-union type (plain
  `ref`, plain scalar) or is union-only in v1.
- Cross-reference pass: new `IrIssueCode`s (`unresolved_ref`, `unresolved_alias_ref`,
  `union_cycle` as info), discriminator `mapping` resolution, empty / single-variant
  union rejection.
- Builder API (`builder.ts`): how `createSourceIR` exposes `addTypeAlias` and
  `f.union(...)` / `f.ref(...)`.
- `gen-angular` recursive-branch fallback: exact behaviour and warning.
- Anonymous inline objects (a property that is an unnamed object) — still unmodelled;
  likely `parser-openapi` synthesises a named entity. Out of scope here, noted for that
  feature.
- Shared-decision helpers (`helpers.ts`): union / ref resolution helper so every
  generator resolves the same way.

## Depends on

- [ir-model](../../_archives/features/ir-model/overview.md) — evolution of an archived
  feature (schemas, validate, builder, helpers, generators).

## Blocks

- [parser-openapi](../parser-openapi/overview.md) — hard, blocking dependency.
