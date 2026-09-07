/**
 * Minimal ambient `zod` `.d.ts` stub, used only by `emit/aliases.compile.test.ts`
 * to real-compile the generator's emitted `aliases.ts` (recursive `z.lazy`
 * chains, `z.union` / `z.discriminatedUnion`, the `z.ZodType<Name>` annotation).
 * This package has no runtime dependency on Zod, so nothing else type-checks the
 * emitted text against Zod's actual shapes. Not part of the published surface.
 */
export const ZOD_DTS = `
export declare class ZodTypeImpl<T = unknown> {
  optional(): ZodTypeImpl<T | undefined>;
  nullable(): ZodTypeImpl<T | null>;
  default(v: T): ZodTypeImpl<T>;
  partial(): ZodTypeImpl<Partial<T>>;
  extend<U extends Record<string, ZodTypeImpl<unknown>>>(
    shape: U,
  ): ZodTypeImpl<T & { [K in keyof U]: U[K] extends ZodTypeImpl<infer V> ? V : never }>;
}
export declare const z: {
  object<U extends Record<string, ZodTypeImpl<unknown>>>(
    shape: U,
  ): ZodTypeImpl<{ [K in keyof U]: U[K] extends ZodTypeImpl<infer V> ? V : never }>;
  string(): ZodTypeImpl<string>;
  int(): ZodTypeImpl<number>;
  number(): ZodTypeImpl<number>;
  boolean(): ZodTypeImpl<boolean>;
  bigint(): ZodTypeImpl<bigint>;
  uuid(): ZodTypeImpl<string>;
  unknown(): ZodTypeImpl<unknown>;
  coerce: { date(): ZodTypeImpl<Date> };
  enum<T extends readonly [string, ...string[]]>(values: T): ZodTypeImpl<T[number]>;
  array<T>(t: ZodTypeImpl<T>): ZodTypeImpl<T[]>;
  union<T extends ZodTypeImpl<unknown>[]>(
    types: T,
  ): ZodTypeImpl<T[number] extends ZodTypeImpl<infer V> ? V : never>;
  discriminatedUnion<T extends ZodTypeImpl<unknown>[]>(
    discriminator: string,
    types: T,
  ): ZodTypeImpl<T[number] extends ZodTypeImpl<infer V> ? V : never>;
  lazy<T>(fn: () => ZodTypeImpl<T>): ZodTypeImpl<T>;
};
export declare namespace z {
  export type infer<T> = T extends ZodTypeImpl<infer U> ? U : never;
  export type ZodType<T = unknown> = ZodTypeImpl<T>;
}
`;
