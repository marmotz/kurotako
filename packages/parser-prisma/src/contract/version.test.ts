import { describe, expect, it } from 'vitest';
import { PrismaContractVersionError } from '../errors.js';
import { assertSupportedVersion } from './version.js';

describe('assertSupportedVersion', () => {
  it('accepts schema version 1', () => {
    expect(() => assertSupportedVersion('1')).not.toThrow();
  });

  it('rejects an unknown schema version', () => {
    expect(() => assertSupportedVersion('2')).toThrow(
      PrismaContractVersionError,
    );
  });
});
