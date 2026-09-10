import { describe, expect, it, vi } from 'vitest';
import { ConsoleReporter } from './reporter.js';

class MemoryStream {
  chunks: string[] = [];
  isTTY = false;
  write(chunk: string): boolean {
    this.chunks.push(chunk);
    return true;
  }
  get text(): string {
    return this.chunks.join('');
  }
}

describe('ConsoleReporter', () => {
  it('suppresses debug by default, shows it with debug: true', () => {
    const quiet = new MemoryStream();
    new ConsoleReporter({ stream: quiet, color: false }).debug('hidden');
    expect(quiet.text).toBe('');

    const loud = new MemoryStream();
    new ConsoleReporter({ stream: loud, color: false, debug: true }).debug(
      'shown',
    );
    expect(loud.text).toContain('shown');
  });

  it('does not colourise when the stream is not a TTY', () => {
    const stream = new MemoryStream();
    new ConsoleReporter({ stream }).info('plain');
    // no ESC (0x1b) anywhere
    expect(stream.text).not.toContain(String.fromCharCode(27));
    expect(stream.text).toBe('tako plain\n');
  });

  it('honours an explicit color: true', () => {
    const stream = new MemoryStream();
    new ConsoleReporter({ stream, color: true }).error('boom');
    expect(stream.text).toContain(String.fromCharCode(27));
  });

  it('writes to its stream and never touches stdout', () => {
    const stream = new MemoryStream();
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    try {
      new ConsoleReporter({ stream, color: false }).info('hi');
      expect(stream.text).toBe('tako hi\n');
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
    }
  });

  it('shows only the message by default, appends structured meta with debug', () => {
    const meta = { namespace: 'tasks', collisionCount: 32 };

    const quiet = new MemoryStream();
    new ConsoleReporter({ stream: quiet, color: false }).warn('clash', meta);
    expect(quiet.text).toBe('tako clash\n');

    const loud = new MemoryStream();
    new ConsoleReporter({ stream: loud, color: false, debug: true }).warn(
      'clash',
      meta,
    );
    expect(loud.text).toBe('tako clash namespace=tasks collisionCount=32\n');
  });

  it('a multi-line message is written verbatim', () => {
    const stream = new MemoryStream();
    new ConsoleReporter({ stream, color: false }).warn('line one\nline two', {
      namespace: 'pg',
    });
    expect(stream.text).toBe('tako line one\nline two\n');
  });

  it('child(tag) tags meta with scope, surfaced with debug', () => {
    const stream = new MemoryStream();
    const reporter = new ConsoleReporter({ stream, color: false, debug: true });
    reporter.child('prisma').info('parsing', { namespace: 'pg' });
    expect(stream.text).toBe('tako parsing scope=prisma namespace=pg\n');
  });
});
