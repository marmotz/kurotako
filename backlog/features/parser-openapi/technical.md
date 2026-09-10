# OpenAPI parser — technical design

**Status**: ready for task breakdown

## Scope and constraints

`@kurotako/parser-openapi` is a new parser driver. It converts one OpenAPI 3.0 or
3.1 document into one `SourceIR`, exactly as `parser-prisma` does for a Prisma
schema. The package exports the driver, its option schema/type, and its `TakoError`
subclasses from `src/index.ts`, matching
[`parser-prisma/src/index.ts`](../../../packages/parser-prisma/src/index.ts).

It accepts a local JSON/YAML document or an unauthenticated HTTP(S) URL. It imports
all component schemas and every reachable inline schema in operations: request
bodies, responses, and path/query/header/cookie parameters. Swagger 2.0, OpenAPI
callbacks/webhooks, custom request headers, authentication, filtering by tag/path,
and unsupported JSON Schema keywords are out of scope.

The implementation uses `@apidevtools/json-schema-ref-parser` as a runtime
dependency. Its `resolve()` API handles JSON/YAML documents, local and HTTP(S)
references, and cyclic reference graphs without dereferencing the schema. The parser
will not call `dereference()`: object identity and resolved references are useful to
the loader but a dereferenced cycle is not serialisable and loses the source `$ref`
structure. A custom resolver rejects schemes other than `file:`, `http:`, and
`https:`, and rejects any URL with a username or password. It is the only network
entry point, which enforces the v1 no-auth rule for the root document and transitive
references.

## Existing integration points

`defineParser` preserves the Valibot option schema and curries validated options out
of the core-facing driver ([`define-driver.ts:19-45`](../../../packages/config/src/define-driver.ts#L19-L45)).
Core invokes `parse()` once for each namespace and checks the returned `SourceIR`
([`core/src/types.ts:81-112`](../../../packages/core/src/types.ts#L81-L112)). The
new driver therefore has the following public surface:

```ts
export const OpenApiParserOptions = v.strictObject({
  document: v.string(),
});

export const openapiParser = defineParser({
  name: 'openapi',
  optionsSchema: OpenApiParserOptions,
  parse(ctx, options): Promise<SourceIR>,
  watchPaths(ctx, options): Promise<string[]>,
  anchor(rootDir, options): string | undefined,
});
```

`document` is required so a misspelled or implicit source cannot silently select a
contract. For a local path it is resolved against `ctx.cwd`; an HTTP(S) URL is used
as-is. `watchPaths` returns the absolute root path for a local document and `[]` for
a remote root. `anchor` returns `dirname(resolve(rootDir, document))` for a local
path and `undefined` for a URL. This follows the existing parser's use of the hooks
at [`parser.ts:55-67`](../../../packages/parser-prisma/src/parser.ts#L55-L67).

The package has these modules:

- `src/options.ts` — strict option schema and inferred type.
- `src/input.ts` — classify and canonicalise a local path or URL; reject bad scheme,
  credentials, and missing local input.
- `src/load.ts` — invoke the selected reference resolver and expose a canonical
  `ResolvedDocument` lookup by URI plus JSON Pointer.
- `src/openapi/schema.ts` — Valibot structural schemas for the OpenAPI subset used by
  this driver, producing located errors before mapping.
- `src/map/` — deterministic name allocation, OpenAPI/JSON Schema mapping, inline
  entity synthesis, enum allocation, and `SourceIR` construction.
- `src/errors.ts` — `OpenApiInputError`, `OpenApiLoadError`, `OpenApiDocumentError`,
  `OpenApiReferenceError`, `OpenApiUnsupportedError`, and
  `OpenApiNameCollisionError`, all extending `TakoError` like
  [`parser-prisma/src/errors.ts:10-25`](../../../packages/parser-prisma/src/errors.ts#L10-L25).

All parser tests use checked-in JSON/YAML fixtures and stubbed `fetch`; no test makes
a real HTTP request.

## IR evolution: typed maps

The current recursive `FieldType` has scalar, enum, unknown, ref, and union variants
only ([`ir/src/types.ts:29-49`](../../../packages/ir/src/types.ts#L29-L49)); the
Valibot tagged union mirrors that list
([`ir/src/schemas.ts:89-106`](../../../packages/ir/src/schemas.ts#L89-L106)). Thus
`additionalProperties` cannot be preserved today. Extend the IR format to version
`'3'` with:

```ts
type FieldType =
  // existing variants
  | { kind: 'map'; value: FieldType };

interface Entity {
  // existing members
  additionalProperties?: FieldType;
}
```

`map.value` models a pure dictionary (`Record<string, value>`). It is valid in a
field, a type alias, a union variant, or recursively as the value of another map.
`Entity.additionalProperties` models an object that has declared fields *and* accepts
additional keys. Its presence is intentionally independent from `fields`: it also
supports an otherwise-empty entity. A missing property means closed/unspecified by
the IR source; OpenAPI maps it explicitly whenever its schema says
`additionalProperties`.

The following changes travel together with the format bump:

- Add the `map` branch and `EntitySchema.additionalProperties` to
  [`ir/src/schemas.ts`](../../../packages/ir/src/schemas.ts), update inferred types,
  and set `IR_VERSION` to `'3'` in
  [`ir/src/version.ts`](../../../packages/ir/src/version.ts#L1-L12).
- Add `map(value => ...)` to `FieldBuilder`, `TypeVariantBuilder`, `UnionBuilder`, and
  `TypeAliasBuilder`; add `additionalProperties(value => ...)` to `EntityBuilder`.
  These extend the existing builder interfaces at
  [`ir/src/builder.ts:45-114`](../../../packages/ir/src/builder.ts#L45-L114).
- Make every recursive helper (`collectRefNames`, cycle detection, `flattenUnion`,
  `scalarTsType`) walk `map.value`; make validation walk the entity-level additional
  property too. This preserves the existing non-fatal recursive-reference treatment.
- Update `docs/ir.md` to document both shapes and the version bump.

No existing parser must emit a map. Its objects retain absent
`additionalProperties`, so this is additive at the in-memory shape but breaking at
the serialized IR boundary; the strict compatibility check correctly requires every
consumer to move to version 3.

## Generator support for maps

Each generator must handle every new `FieldType` branch; the existing switches in
Zod ([`render/scalars.ts:62-114`](../../../packages/gen-zod/src/render/scalars.ts#L62-L114)),
TypeScript ([`render/scalars.ts:62-85`](../../../packages/gen-typescript/src/render/scalars.ts#L62-L85)),
and Angular ([`render/controls.ts:42-60`](../../../packages/gen-angular/src/render/controls.ts#L42-L60))
are exhaustive points to extend.

- **Zod**: `map.value` emits `z.record(z.string(), <value>)`. An entity with
  `additionalProperties` emits its existing object expression followed by
  `.catchall(<value>)`; this preserves the exact OpenAPI runtime validation rule.
  Dependency collection and cyclic-reference laziness recurse through the map value.
- **TypeScript**: a pure map renders `Record<string, Value>`. An entity with fields
  and `additionalProperties: Value` retains its ordinary members and gains an index
  signature accepting `Value | DeclaredFieldValueUnion`. TypeScript cannot express
  “all string keys except these literal property names”; this documented superset
  keeps known fields assignable while Zod remains exact at runtime. Import collection
  recurses through both branches.
- **Angular**: a map field is one `FormControl<Record<string, Value>>`, seeded as
  `{}`. An entity-level catch-all remains a `FormGroup` for declared controls plus no
  generated dynamic controls; its Zod validator accepts and checks dynamically added
  values. The same control type is used for Reactive and Signal Forms. Recursive map
  values use the current union/ref fallback rather than creating an infinite form
  tree.

This work is a hard prerequisite for the OpenAPI parser, not a change made by the
parser package alone.

## Loading and reference resolution

`load.ts` must parse the root with `@apidevtools/json-schema-ref-parser`, call
`resolve()` (not `bundle()` or `dereference()`), and retain its canonical `$Refs`
index. Every mapping function receives `{ rootUri, refs }` and resolves a `$ref` by
the pair `(canonical document URI, decoded JSON Pointer)`. The same pair is the
identity key for components and inline schemas.

References are resolved once by the library. A recursive graph is legal: the mapper
first allocates a name and places an unfinished entry in its name table, then maps its
children. Revisiting the identity returns `FieldType.ref` to that allocated name. No
structural comparison is performed: equal-looking schemas at different canonical
locations receive different names, while repeated references to one location share
one name.

The parser rejects a reference that does not resolve, resolves outside the supported
schemes, contains credentials, or targets a value which is not a schema object. Such
failures include the referring canonical URI and JSON Pointer in `OpenApiReferenceError`.
This is preferable to an `unknown` fallback because a missing remote contract changes
the generated API surface.

## Mapping OpenAPI to the IR

The mapper accepts only the object subset of JSON Schema. It uses a per-source name
registry spanning entities, enums, and type aliases; a collision after normalisation
is an `OpenApiNameCollisionError`, never an auto-suffixed identifier.

### Roots and naming

- `components.schemas.<Name>` becomes entity `<Name>` for an object schema, or a type
  alias `<Name>` for a scalar, enum, array, map, or root union.
- A reference target whose pointer ends in `components/schemas/<Name>` uses `<Name>` as
  its allocation base even when it lives in an external document. Any other reference
  target uses the first contextual owner name that reaches it; its canonical identity,
  not that context, prevents duplicate allocation.
- An inline object becomes a synthetic entity. Its base name is the owner entity and
  field name (`UserAddress`); an inline root under an operation uses the operation
  role below. Repeated identity returns the previously allocated name.
- `operationId` is converted to UpperCamelCase. Without it, the method plus normalised
  path is used (`POST /users/{id}` → `PostUsersById`). No warning is produced.
- Request bodies use `<Operation>Request`. Parameter schemas use
  `<Operation><Location><Parameter>`. Responses use
  `<Operation><Status>Response<Media>`, where the media suffix is the normalised media
  type (`application/json` → `Json`). Status and media always remain present to make
  collisions impossible.

`description` becomes IR `doc` on the corresponding entity, field, enum, or alias.
`title` is used only when the schema has no allocated contextual name. `default` is
copied only when it is JSON-serialisable; it sets `Field.default` for a field and is
ignored for aliases, which have no default slot.

### Object fields and required/nullability rules

For an object, each `properties` entry becomes a field unless it is an object shape
that must be synthesised; the field then uses `ref` to the child entity. Membership
in the enclosing `required` array sets `optional: false`; absence sets
`optional: true`. This differs deliberately from the Prisma parser's database-default
meaning for `optional` documented at
[`map/build.ts:164-172`](../../../packages/parser-prisma/src/map/build.ts#L164-L172):
for an HTTP input schema it denotes a missing payload property.

OpenAPI 3.0 `nullable: true` and OpenAPI 3.1 `type: [T, 'null']` both set
`nullable: true`; the non-null member maps normally. A 3.1 multi-type array with more
than one non-null member maps to a union. An array maps its item type then sets
`list: true`; nested arrays are rejected because the current IR has one list wrapper.

`additionalProperties: false` generates no IR extension. `true` maps to
`{ kind: 'map', value: { kind: 'unknown' } }` for a pure map, or to
`Entity.additionalProperties` for an object with named properties. A schema value is
mapped recursively in the same positions. `patternProperties`, `propertyNames`, and
unevaluated-property keywords are unsupported and fatal in v1.

### Scalars, constraints, enums, and compositions

| OpenAPI shape | IR result |
| --- | --- |
| `string` | `scalar: 'string'` |
| `boolean` | `scalar: 'boolean'` |
| `integer`, `int32` | `scalar: 'int'` |
| `integer`, `int64` | `scalar: 'bigint'` |
| `number`, `float`/`double` | `scalar: 'float'` |
| `string`, `date` / `date-time` | `scalar: 'date'` / `'datetime'` |
| `string`, `uuid` | `scalar: 'uuid'` |
| `string`, `byte` / `binary` | `scalar: 'bytes'` |
| `email`, URI/URL, IPv4, IPv6, time, duration | string scalar plus the matching existing `StringFormat` |
| password, custom, or other unmodelled format | string scalar; format is accepted but not retained |

`minimum`, `maximum`, `minLength`, `maxLength`, and `pattern` map to the matching
IR constraints. Exclusive numerical bounds are unsupported because the IR only has
inclusive `min`/`max`; `multipleOf`, content encoding/media type, examples, and
readOnly/writeOnly are also fatal in v1 rather than silently weakened.

A string-only `enum` creates an IR enum. A named enum uses its component/synthetic
name; a property enum uses `<Entity><Field>`. A non-string enum maps to `unknown` and
is never assigned invented TypeScript identifiers. `allOf` recursively combines
properties and constraints; duplicate property names require identical mapped field
shapes or throw `OpenApiUnsupportedError`. `oneOf` and `anyOf` create the existing
IR union form; `discriminator` is copied only if all mapping targets are its same-source
`ref` variants. Root unions are type aliases, as required by the union-type feature.

`$ref` used as a property, array item, map value, or union variant always maps to
`FieldType.ref`; it never maps to `Relation`. `Relation` carries ORM metadata and is
not a payload field, whereas the current generators traverse `FieldType.ref` in both
their type and schema emitters. This corrects the earlier product wording and is
recorded in the overview.

## Alternatives rejected

- **Hand-written YAML parser, URL loader, and JSON Pointer resolver**: rejected in
  favour of `@apidevtools/json-schema-ref-parser`; the latter already resolves mixed
  local/remote JSON/YAML reference graphs and cycles. The driver still owns the
  security policy through its resolver configuration.
- **`dereference()` or structural schema deduplication**: rejected because cycles become
  object cycles and separately named API concepts could be silently merged.
- **Model `$ref` as `Relation`**: rejected because relations are not payload fields and
  would omit referenced data from generated flat Zod schemas and TypeScript DTOs.
- **Degrade `additionalProperties` to JSON/unknown**: rejected because it discards the
  typed dictionary contract. The IR and all generators evolve together instead.
- **Silently ignore unsupported keywords or incompatible `allOf` fields**: rejected;
  the parser fails with a located diagnostic so generated validation never claims a
  stronger contract than it can implement.

## Verification

Tests are added alongside every changed module and cover:

- option validation, local JSON/YAML, HTTP(S), no-auth enforcement, local and remote
  `$ref`, pointer escaping, repeated references, and reference cycles;
- OpenAPI 3.0/3.1 nullability, component/inline object naming, all operation input
  locations, media/status naming, required fields, arrays, maps, all format rows,
  enums, unions/discriminators, `allOf`, and every rejected construct;
- IR schemas, builder, validation, helpers, and strict v2/v3 incompatibility;
- Zod runtime parsing for pure/mixed maps, TypeScript emitted type compilation, and
  Angular generated reactive/signal form compilation for map controls;
- a pipeline integration fixture proving that a configured `openapiParser` merges with
  existing sources and feeds Zod, TypeScript, and Angular generators.

Run the affected package tests, then the workspace `tsc -b` and full test suite before
merging. The IR evolution and affected published generators receive changesets; the
new parser receives its initial published package version.

## Découpage en tâches d'implémentation

1. [#134 — Add typed map support to IR v3](https://github.com/marmotz/kurotako/issues/134)
2. [#135 — Emit typed maps and catch-all objects in Zod](https://github.com/marmotz/kurotako/issues/135) — depends on #134.
3. [#136 — Render typed map declarations in TypeScript](https://github.com/marmotz/kurotako/issues/136) — depends on #134.
4. [#137 — Support typed map controls in Angular](https://github.com/marmotz/kurotako/issues/137) — depends on #134 and #135.
5. [#138 — Scaffold the OpenAPI driver and resolve documents](https://github.com/marmotz/kurotako/issues/138)
6. [#139 — Map component schemas to IR v3](https://github.com/marmotz/kurotako/issues/139) — depends on #134 and #138.
7. [#140 — Synthesize operation payload schemas and prove pipeline integration](https://github.com/marmotz/kurotako/issues/140) — depends on #135, #136, #137, and #139.
