# @kurotako/gen-react-tanstack

The React + TanStack Form generator for [kurotako](https://kurotako.marmotz.dev/): emits one typed
`useXxxForm` hook per entity, validated by the Zod schemas kurotako generates from the same
intermediate representation.

Embeds `@kurotako/gen-zod` as a private dependency: `core` runs its own copy of the Zod
generator for it, into `<namespace>/react-tanstack/zod/`, so you do not list `zodGenerator` in
`generators`. Set the Zod flavor with the `zodVersion` option (default `4`).

## Install

```bash
npm install -D @kurotako/gen-react-tanstack
npm install @tanstack/react-form zod
# bun add -d @kurotako/gen-react-tanstack && bun add @tanstack/react-form zod
```

Needs **Node.js >= 24**; runs unmodified on Node and Bun. The generated code needs
`@tanstack/react-form` `^1.17.0`; Zod 3 mode needs `zod >= 3.24` (Standard Schema support).

## Usage

```ts title="tako.config.ts"
import { defineConfig } from 'kurotako';
import { reactTanstackGenerator } from '@kurotako/gen-react-tanstack';

export default defineConfig({
  sources: {/* ... */},
  generators: [
    {
      use: reactTanstackGenerator,
      options: { include: ['LoginDto'] },
    },
  ],
  outputs: [{ dir: './src/generated' }],
});
```

```tsx
import { useLoginDtoForm } from './generated/api/react-tanstack/LoginDto.form';

function LoginForm() {
  const form = useLoginDtoForm({ onSubmit: ({ value }) => login(value) });
  return (
    <form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
      <form.Field name="email">
        {(field) => (
          <input
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
          />
        )}
      </form.Field>
    </form>
  );
}
```

The hook returns the regular TanStack Form instance. Pass `schema` to replace the generated
schema with a refined or extended one, `validation` to change when validation runs (default:
on submit, then on change), and use `form.setErrorMap(...)` for server errors.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `zodVersion` | `4` | Zod API flavor of the private Zod copy (`3` or `4`). |
| `include` | all entities | Entity names to emit hooks for, in every covered namespace. |
| `variants` | `['full']` | Zod variant a hook is built on: `full`, `create`, `update`. |
| `relations` | `'flat'` | `flat`: scalar and enum fields; `deep`: nested objects and arrays. |

## Documentation

Catalog and guides: [https://kurotako.marmotz.dev/](https://kurotako.marmotz.dev/).

`0.x`: the public API may change between minor versions.

## License

[MIT](https://github.com/marmotz/kurotako/blob/develop/LICENSE)
