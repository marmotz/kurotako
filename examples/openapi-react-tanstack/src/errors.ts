/**
 * A field error is a Standard Schema issue (from the generated Zod schema) or the plain
 * string set through `formApi.setErrorMap` (a server error).
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  return (error as { message?: string } | undefined)?.message ?? '';
}
