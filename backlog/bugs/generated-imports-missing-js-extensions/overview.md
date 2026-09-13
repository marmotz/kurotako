# Bug: generated relative imports are missing `.js` extensions

**Status**: technical design ready — see [`technical.md`](technical.md)

## Context

Found while wiring `@kurotako/gen-typescript@0.3.2` as a new `api` source
(OpenAPI → TypeScript) in a downstream monorepo
([`ekoz`](https://github.com/marmotz/ekoz), see its
[SDK foundations technical design §11](https://github.com/marmotz/ekoz/blob/develop/backlog/features/sdk-foundations/technical.md#11-typage-bout-en-bout)
and [issue #21](https://github.com/marmotz/ekoz/issues/21)). That repo's root
`tsconfig.base.json` sets `"module": "NodeNext"`, `"moduleResolution":
"NodeNext"` — the strict ESM mode where every relative import/export
specifier must carry an explicit extension.

## Reproduction

Running `tako generate` against a real `openapi.json` with only the `api`
source configured (`@kurotako/parser-openapi@0.2.2` +
`@kurotako/gen-typescript@0.3.2`, `kurotako@0.2.1`) produces 48 files that
generate cleanly, but fail `tsc --noEmit` under `moduleResolution: NodeNext`:

```
src/generated/api/typescript/aliases.ts(2,45): error TS2307: Cannot find module './AcceptedResponseDto.type' or its corresponding type declarations.
```

Every relative specifier in the generated output is missing its extension,
for example (`aliases.ts`):

```ts
import type { AcceptedResponseDtoDto } from './AcceptedResponseDto.type';
```

instead of the extension-qualified form Node16/NodeNext resolution requires:

```ts
import type { AcceptedResponseDtoDto } from './AcceptedResponseDto.type.js';
```

Same pattern in every `*.type.ts` file's own relative imports (mostly of
`./filters`), in `typescript/index.ts`'s barrel re-exports, and in
`api/index.ts`'s `export * from './typescript'` — the last one is a directory
import and needs `./typescript/index.js`, not `./typescript.js`.

## Scope: not limited to `gen-typescript`

The same extensionless-specifier pattern was found in every generator's emit
code, and in `core`'s own synthesized barrel:

- `packages/gen-typescript/src/emit/{aliases,entity,barrel}.ts`
- `packages/gen-zod/src/emit/{aliases,entity,barrel}.ts`
- `packages/gen-angular/src/emit/barrel.ts`
- `packages/core/src/writer/barrel.ts` (`synthesizeRootBarrels`, used by
  every generator to build `<namespace>/index.ts`)

This is also a **documented, deliberate constraint** today, not just an
oversight: `packages/core/src/errors.ts` tells output-mode-B consumers to
pin `"moduleResolution": "bundler"` in their generated package's
`tsconfig.base.json`, explicitly because `"node16"`/`"nodenext"` "would fail
to compile the extensionless `export * from './zod';` that tako's generated
root barrel always emits."

Decision: this bug covers all four locations above as one fix, not just
`gen-typescript`. See [`docs/architecture.md`](../../../docs/architecture.md)
for how generators and the core writer/barrel step relate.

## Root cause (suspected)

Every emit module (per generator) and `core`'s root-barrel synthesizer build
relative specifiers as plain strings (`` `./${name}` ``) without appending an
extension and without accounting for `moduleResolution`. None of the
generators currently expose an `optionsSchema` entry for this, so there is no
way to opt into extension-qualified output today.

## Impact

Any consumer whose `tsconfig` uses `module`/`moduleResolution:
NodeNext`/`node16` (the TypeScript-recommended setting for real ESM
packages) cannot typecheck generated output as committed — in output mode A
(directory, consumer's own `tsconfig`) or mode B (npm package, where it's
already worked around by mandating `moduleResolution: bundler`) — even
though the generated *type content* is correct. `bundler`/`node10`
resolution is unaffected (extensions are optional there), so this didn't
surface in kurotako's own fixtures, which don't exercise `NodeNext`.

## Workaround in use downstream

A small post-processing script
([`scripts/fix-sdk-generated-imports.mjs`](https://github.com/marmotz/ekoz/blob/develop/scripts/fix-sdk-generated-imports.mjs))
runs after `tako generate` and appends `.js` (or `/index.js` for a directory
import) to every relative specifier under the generated output directory,
chained into the `generate` script. This is a stopgap, not a fix — it has to
be re-applied after every regeneration and duplicates logic the generator
itself should own.

## Decisions made

- **Scope**: fix `gen-typescript`, `gen-zod`, `gen-angular`, and `core`'s
  `synthesizeRootBarrels` together, as one cross-cutting change — not a
  `gen-typescript`-only patch with follow-up bugs for the others.
- **Approach**: always emit `.js`-qualified relative specifiers by default
  (resolving a directory target to `.../index.js`), with no new config
  surface. This is valid under every `moduleResolution` mode (`nodenext`,
  `node16`, `bundler`, `node10` all accept an explicit `.js` on a relative
  import to a `.ts` source once `allowJs`/`declaration` output maps `.ts` →
  `.js`), so it should not regress consumers who are passing today. No
  generator currently has an `optionsSchema` entry for this, so this avoids
  introducing one just for extension handling.
- **Mode-B docs**: once barrels are extension-qualified, update the
  `MISSING_PACKAGE_WORKSPACE_FILE_GUIDANCE` message in
  `packages/core/src/errors.ts` (and any related test/doc) to stop steering
  consumers away from `node16`/`nodenext` — that guidance was only needed
  because of this bug.

## Suggested fix

Introduce one shared helper (likely in `core`, reused by every generator's
emit code and by `synthesizeRootBarrels`) that turns a bare relative module
path into an extension-qualified specifier — appending `.js` for a file
target and `/index.js` for a directory/barrel target — and use it everywhere
a relative `from '...'`/`export * from '...'` string is currently built by
hand.
