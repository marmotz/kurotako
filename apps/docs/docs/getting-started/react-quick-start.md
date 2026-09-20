---
title: React quick start
sidebar_position: 3
---

# React quick start

This walkthrough turns the request bodies of an OpenAPI document into typed React form
hooks, built on [TanStack Form](https://tanstack.com/form) and validated by Zod schemas
generated from the same source. It assumes you have run the [quick start](quick-start.md)
once and know the three parts of a `tako.config.ts`.

## 1. Install

```bash
npm install -D kurotako @kurotako/parser-openapi @kurotako/gen-react-tanstack
npm install @tanstack/react-form zod
# bun add -d kurotako @kurotako/parser-openapi @kurotako/gen-react-tanstack
# bun add @tanstack/react-form zod
```

`@tanstack/react-form` `^1.17.0` is required. `@kurotako/gen-react-tanstack` embeds its own
copy of the Zod generator (a
[private dependency](../concepts/dependency-graph.md)), so there is no `zodGenerator` entry
to add.

## 2. Configure

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { openapiParser } from '@kurotako/parser-openapi';
import { reactTanstackGenerator } from '@kurotako/gen-react-tanstack';

export default defineConfig({
  sources: {
    api: { use: openapiParser, options: { document: './openapi.yaml' } },
  },
  generators: [
    {
      use: reactTanstackGenerator,
      options: { include: ['LoginDto', 'RegisterDto'] },
    },
  ],
  outputs: [{ dir: './src/generated' }],
});
```

`include` restricts the hooks to the entities you build forms for (here the request-body
DTOs). A name that exists in no covered namespace is an error, so a typo cannot silently
emit nothing. The other options are in the [catalog](../reference/catalog.md#kurotakogen-react-tanstack).

```bash
npx tako generate
```

This writes, per namespace, `api/react-tanstack/` (one `<Entity>.form.ts` per entity, a
`form.runtime.ts` and a barrel) and the private Zod copy under `api/react-tanstack/zod/`.

## 3. Use a hook

Each hook returns the regular TanStack Form instance, typed with the entity's DTO:

```tsx
import { useLoginDtoForm } from './generated/api/react-tanstack/LoginDto.form';

export function LoginForm() {
  const form = useLoginDtoForm({
    onSubmit: async ({ value }) => {
      await login(value); // value: LoginDtoDto
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <>
            <input
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <p key={errorMessage(error)}>{errorMessage(error)}</p>
            ))}
          </>
        )}
      </form.Field>
      <button type="submit">Log in</button>
    </form>
  );
}
```

The hook accepts `defaultValues` (partial, merged over the generated defaults), `schema`,
`validation`, `onSubmit` and `onSubmitInvalid`. Everything else is reachable on the
returned instance.

### Field errors

`field.state.meta.errors` holds Standard Schema issues (from the generated Zod schema) and
the plain strings set by `setErrorMap`, so read both:

```ts
function errorMessage(error: unknown): string {
  return typeof error === 'string'
    ? error
    : ((error as { message?: string } | undefined)?.message ?? '');
}
```

### Default values

`default<Entity>FormValues(init?)` seeds each field from its literal default, else a type
zero: `''`, `0`, `false`, `0n`, `new Date(0)`, the first member of an enum, `[]` for a list,
`null` for a nullable field. A field with no synthesizable zero (an object reference or a
union) starts `undefined`; Zod flags it until it is filled. Optional fields are seeded the
same way as required ones (an optional `date` starts as `new Date(0)`): pass `defaultValues`
to control what a form starts with.

### A refined schema at the call site

`schema` replaces the generated schema, so a rule the source cannot express is added where
the form is built:

```tsx
import { LoginDtoSchema } from './generated/api/react-tanstack/zod/LoginDto.schema';

const form = useLoginDtoForm({
  schema: LoginDtoSchema.refine((value) => value.password !== value.email, {
    message: 'The password must differ from the email',
    path: ['password'],
  }),
});
```

`.extend(...)` works the same way. The option accepts any Standard Schema whose output is
the form's values. In Zod 3 mode, Standard Schema support needs `zod >= 3.24`.

### Validation timing

By default a form validates on submit, then revalidates on every change once it has been
submitted. Change it with `validation`:

```tsx
useLoginDtoForm({ validation: { mode: 'change', modeAfterSubmission: 'change' } });
```

`mode` applies before the first submit and `modeAfterSubmission` after it; each is
`'change'`, `'blur'` or `'submit'`.

### Server errors

Errors returned by your API are not generated; set them on the instance, with the same
dotted or indexed paths TanStack uses:

```tsx
const form = useLoginDtoForm({
  onSubmit: async ({ value, formApi }) => {
    const response = await login(value);
    if (response.status === 409) {
      formApi.setErrorMap({ onSubmit: { fields: { email: 'Already registered' } } });
    }
  },
});
```

The hook's options are intentionally limited to the five above; a form-level
`onSubmitAsync` validator is not exposed through them.

### Dates

A Zod `date` field is generated as `z.coerce.date()`, so the form value stays a `Date`
(seeded `new Date(0)`), and the schema accepts what an input produces. TanStack passes the
form's own values to `onSubmit`, not the schema output: no parse step runs on submit.

## Variants and relations

- `variants: ['create', 'update']` builds hooks on the create and update payload shapes
  (`useUserCreateForm`, `useUserUpdateForm`), reusing the same field selection as the Zod
  variants. Each hook has its own `default…FormValues`, `…FormApi` and
  `Use…FormOptions`.
- `relations: 'deep'` nests a to-one relation as an object and a to-many relation as an
  array; TanStack addresses them natively (`author.name`, `tags[0].name`) and a Zod issue
  lands on the matching nested field. A to-one relation is seeded with the target entity's
  own default values.

TanStack Form cannot type a self-referential values type, so the generated values type
(`<Entity>FormValues`) cuts recursion: a field that refers back into a `ref` cycle is typed
`unknown`, and in deep mode a relation is followed at most two levels below the entity and
never back to an entity already on the path. The generated Zod schema still validates the
full shape.
