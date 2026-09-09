/** The JsonValue helper emitted when at least one field needs it. */
export function emitScalars(): string {
  return `export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };
`;
}
