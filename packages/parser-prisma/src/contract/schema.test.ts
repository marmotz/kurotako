import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PrismaContractError } from '../errors.js';
import { parseContract } from './schema.js';

const fixture = readFileSync(
  join(import.meta.dirname, '__fixtures__', 'contract.json'),
  'utf8',
);

describe('parseContract', () => {
  it('accepts the captured contract fixture', () => {
    expect(parseContract(fixture).schemaVersion).toBe('1');
  });

  it('tolerates unknown keys added by Prisma', () => {
    const raw = JSON.parse(fixture) as Record<string, unknown>;
    raw.futurePrismaKey = { enabled: true };
    expect(parseContract(JSON.stringify(raw)).schemaVersion).toBe('1');
  });

  it('wraps invalid JSON', () => {
    expect(() => parseContract('{')).toThrow(PrismaContractError);
  });

  it('reports an invalid required path', () => {
    expect(() => parseContract(JSON.stringify({ schemaVersion: '1' }))).toThrow(
      /domain/,
    );
  });
});
