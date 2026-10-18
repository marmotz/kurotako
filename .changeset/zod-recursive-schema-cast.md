---
'@kurotako/gen-zod': patch
---

Emit recursive schemas as `export const X = <expr> as unknown as z.ZodType<XDto>` instead of a `: z.ZodType<XDto> = <expr>` annotation. The annotation forced TypeScript to compare the full inferred zod type against `ZodType<Dto>` for every deep, where and select schema; on a densely connected model this took hundreds of thousands of type instantiations and several GB of heap (`tsc`, tsup `.d.ts` build in output mode B). The exported type is unchanged.
