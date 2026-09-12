# openapi-sdk-typescript

A minimal example with **no backend at all**: `openapi.json` is a static,
third-party contract (here, a copy of the one produced by
[`nestjs11-openapi-angular22-outputdir`](../nestjs11-openapi-angular22-outputdir/)'s
backend — it could just as well be a URL, or a file dropped in by hand). The point is
building a small, typed **SDK package** on top of it, not a full app.

## How it flows

1. `openapi.json` — the committed contract. `@kurotako/parser-openapi` accepts a
   local path or an `http(s)://` URL for `options.document` (see `tako.config.ts`);
   this example uses a local file.
2. `bun run tako:generate` — `@kurotako/gen-typescript` reads the IR and emits
   **types only** (`TaskDto`, `NewTaskDto`, `ProjectDto`, `UserDto`, ...) into
   `src/generated/tasks/typescript/`. The IR carries schemas, not HTTP operations,
   so there is no operation-aware generator here.
3. `src/sdk.ts` — a hand-written `TasksSdk` class wrapping `fetch`, typed against
   the generated DTOs (`listTasks(): Promise<TaskDto[]>`,
   `createTask(task: NewTaskDto): Promise<TaskDto>`, `getTask(id): Promise<TaskDto>`).
4. `src/index.ts` re-exports the SDK and its DTOs as the package's public API.

Re-run `tako:generate` whenever `openapi.json` changes; the SDK's method
signatures then fail to typecheck if a payload shape changed underneath them.

## Setup

Kurotako packages are consumed via `bun link` from this local clone:

```bash
# from the repo root, once, after any change to a linked package:
bun run --filter '*' build
cd packages/cli            && bun link && cd -
cd packages/config         && bun link && cd -
cd packages/parser-openapi && bun link && cd -
cd packages/gen-typescript && bun link && cd -
```

```bash
# from this project's root, once per clone:
bun link @kurotako/cli @kurotako/config @kurotako/parser-openapi @kurotako/gen-typescript
bun install
```

## Generate

```bash
bun run tako:generate   # src/generated/tasks/typescript/
```

## Test

```bash
bun run test
```

## Build

```bash
bun run build   # dist/ (ESM + CJS + .d.ts), as if publishing @example/tasks-sdk
```
