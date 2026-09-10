import * as v from 'valibot';

export const OpenApiParserOptions = v.strictObject({ document: v.string() });
export type OpenApiParserOptions = v.InferOutput<typeof OpenApiParserOptions>;
