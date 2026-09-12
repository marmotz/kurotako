import { defineConfig } from '@kurotako/config';
import { typescriptGenerator } from '@kurotako/gen-typescript';
import { openapiParser } from '@kurotako/parser-openapi';

export default defineConfig({
  sources: {
    // `openapi.json` is a static contract: nothing in this project produces it.
    // It could equally be an `https://` URL — parser-openapi accepts both.
    tasks: {
      use: openapiParser,
      options: { document: './openapi.json' },
    },
  },
  // Types only: the SDK hand-writes its request/response wiring in `src/sdk.ts`
  // over the generated `TaskDto` / `NewTaskDto` / `ProjectDto` / `UserDto` types.
  generators: [{ use: typescriptGenerator }],
  outputs: [{ dir: './src/generated' }],
});
