# openapi-react-tanstack

A minimal example with **no backend**: `openapi.json` is a static contract (it could just
as well be an `http(s)://` URL, which `@kurotako/parser-openapi` also accepts).
`@kurotako/gen-react-tanstack` turns its **request bodies** into typed
[TanStack Form](https://tanstack.com/form) hooks, consumed by a small Vite + React app.

## How it flows

1. `openapi.json` — the committed contract: `LoginDto` and `RegisterDto` (request bodies) and
   `Account` (a response).
2. `bun run tako:generate` — `@kurotako/parser-openapi` reads it and the React generator
   writes `src/generated/api/react-tanstack/` (mode A: plain `.ts` straight into the app,
   compiled by Vite):
   - `LoginDto.form.ts` / `RegisterDto.form.ts` — `useLoginDtoForm`, `useRegisterDtoForm`,
     their `default…FormValues`, `…FormApi` and `Use…FormOptions`;
   - `form.runtime.ts` — the only file calling `@tanstack/react-form`;
   - `zod/` — the generator's **private Zod copy**, which the hooks validate against.
3. `src/LoginForm.tsx` uses `useLoginDtoForm` with a **runtime-refined schema**
   (`LoginDtoSchema.refine(...)`, a rule the contract cannot express), and shows a server
   error on a field through `formApi.setErrorMap`. `src/RegisterForm.tsx` overrides some
   generated default values.

`tako.config.ts` restricts the hooks to the request bodies with `include`; there is no
`zodGenerator` entry, since the app never imports `api/zod` itself.

The generated code imports its own modules as `api/...` (the namespace is the config key):
`tsconfig.json` (`paths`) and `vite.config.ts` (`resolve.alias`) both map `api` to
`src/generated/api`.

## Setup

Kurotako packages are consumed via `bun link` from this local clone:

```bash
# from the repo root, once, after any change to a linked package:
bun run --filter '*' build
cd packages/cli                 && bun link && cd -
cd packages/config              && bun link && cd -
cd packages/parser-openapi      && bun link && cd -
cd packages/gen-react-tanstack  && bun link && cd -
```

```bash
# from this project's root, once per clone:
bun link @kurotako/cli @kurotako/config @kurotako/parser-openapi @kurotako/gen-react-tanstack
bun install
```

## Generate

```bash
bun run tako:generate   # src/generated/api/react-tanstack/
```

## Run

```bash
bun run dev     # Vite dev server
bun run test    # vitest + Testing Library: schema issues, the refined rule, a server error
bun run build   # tsc --noEmit && vite build
```

## Mode B: an npm package

`tako.config.package.ts` is the same source and generator emitted as one installable
`@example/api` package under `packages/example-api/` (built with `tsup`; `@tanstack/react-form`
and `zod` are declared once as peer dependencies, the Zod range coming from the private
Zod copy):

```bash
bun run tako:generate:package
```

Mode B needs `tsconfig.base.json` and `tsup.config.base.ts` at the project root (one
directory above `packagesDir`); both are committed here. The hooks are then imported from
the package, `import { useLoginDtoForm } from '@example/api'` (or the subpath
`@example/api/react-tanstack/LoginDto.form`), instead of from `src/generated`, and the app
no longer needs the `api` alias. To consume it from another workspace, add it to that
workspace's dependencies as the `nestjs11-openapi-angular22-outputpkg` example does.
