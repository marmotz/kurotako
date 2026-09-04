import { createSourceIR } from '@kurotako/ir';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { AngularGeneratorOptions } from '../options.js';
import { blogSource } from '../testing/ir.js';
import { emitBarrel } from './barrel.js';

describe('emitBarrel', () => {
  it('re-exports the runtime file and every entity form', () => {
    const options = v.parse(AngularGeneratorOptions, {});
    const text = emitBarrel(blogSource(), options);
    expect(text).toBe(
      "export * from './zod-forms.runtime';\nexport * from './User.form';\nexport * from './Post.form';\n",
    );
  });

  it('a zero-entity source still emits a valid (possibly empty) index.ts', () => {
    const source = createSourceIR({
      namespace: 'empty',
      parser: 'test',
    }).build();
    const options = v.parse(AngularGeneratorOptions, {});
    expect(emitBarrel(source, options)).toBe('\n');
  });

  it('no runtime re-export when forms is empty', () => {
    const options = v.parse(AngularGeneratorOptions, { forms: [] });
    const text = emitBarrel(blogSource(), options);
    expect(text).not.toContain('zod-forms.runtime');
  });
});
