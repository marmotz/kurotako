import { describe, expect, it } from 'vitest';
import { UnsupportedOutputModeError } from '../errors.js';
import { directoryWriter, packageWriter, selectWriter } from './index.js';

describe('selectWriter', () => {
  it('returns directoryWriter for undefined mode', () => {
    expect(selectWriter({})).toBe(directoryWriter);
  });

  it("returns directoryWriter for mode 'dir'", () => {
    expect(selectWriter({ mode: 'dir' })).toBe(directoryWriter);
  });

  it("returns packageWriter for mode 'package'", () => {
    expect(selectWriter({ mode: 'package' })).toBe(packageWriter);
  });

  it('throws UnsupportedOutputModeError for an unknown mode', () => {
    expect(() => selectWriter({ mode: 'weird' as never })).toThrow(
      UnsupportedOutputModeError,
    );
  });
});
