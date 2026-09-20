import { describe, expect, it } from 'vitest';
import { emitBarrel } from './barrel.js';

describe('emitBarrel', () => {
  it('re-exports the runtime file and every entity form', () => {
    expect(emitBarrel(['User', 'Post'])).toBe(
      "export * from './form.runtime.js';\nexport * from './User.form.js';\nexport * from './Post.form.js';\n",
    );
  });

  it('a namespace with no emitted entity still yields a valid module', () => {
    expect(emitBarrel([])).toBe('export {};\n');
  });
});
