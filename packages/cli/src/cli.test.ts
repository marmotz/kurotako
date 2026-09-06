import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { runCli } from './cli.js';

let stdout: string;
let stderr: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;
let stderrSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  stdout = '';
  stderr = '';
  process.exitCode = undefined;
  stdoutSpy = vi
    .spyOn(process.stdout, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stdout += c.toString();
      return true;
    });
  stderrSpy = vi
    .spyOn(process.stderr, 'write')
    .mockImplementation((c: string | Uint8Array) => {
      stderr += c.toString();
      return true;
    });
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
  process.exitCode = undefined;
});

describe('runCli', () => {
  it('--version prints the injected version on stdout, exit 0', async () => {
    await runCli(['--version']);
    expect(stdout.trim()).toBe(pkg.version);
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('no args prints usage, exit 0', async () => {
    await runCli([]);
    expect(stdout).toContain('USAGE');
    expect(process.exitCode ?? 0).toBe(0);
  });

  it('--help prints usage, exit 0', async () => {
    await runCli(['--help']);
    expect(stdout).toContain('USAGE');
  });

  it('an unknown command exits 1 with citty’s message', async () => {
    await runCli(['nope']);
    expect(process.exitCode).toBe(1);
    expect(stderr.toLowerCase()).toContain('unknown command');
  });

  it('an unknown top-level flag exits 1', async () => {
    await runCli(['--bogus']);
    expect(process.exitCode).toBe(1);
  });
});
