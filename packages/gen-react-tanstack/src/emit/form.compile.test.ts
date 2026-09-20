/**
 * Real-compiles the generator's output (this package's generated text plus
 * `@kurotako/gen-zod`'s, which it imports) against the REAL `@tanstack/react-form`,
 * `react` and `zod` declarations. This pins what the hand-written runtime file
 * assumes about upstream: the 12-generic order of `ReactFormExtendedApi`, that
 * `StandardSchemaV1` is exported by `@tanstack/react-form`, and that a Zod schema
 * (including a call-site `extend` / `refine` one) is assignable to the hook's
 * `schema` option.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VirtualFile } from '@kurotako/core';
import * as ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ReactTanstackGeneratorOptions } from '../options.js';
import { generateFiles, writeFiles } from '../testing/generated.js';
import {
  apiSource,
  blogSource,
  checkoutSource,
  irOf,
  shopSource,
} from '../testing/ir.js';

const PACKAGE_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);

let dir: string;

beforeAll(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gen-react-tanstack-compile-'));
  // The real dependencies come from this package's own node_modules.
  await fs.symlink(
    path.join(PACKAGE_ROOT, 'node_modules'),
    path.join(dir, 'node_modules'),
  );
  await fs.writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'gen-react-tanstack-compile', type: 'module' }),
  );
});

afterAll(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const NAMESPACES = ['api', 'blog', 'checkout', 'shop'];

async function typecheck(
  files: readonly VirtualFile[],
  extra: readonly VirtualFile[] = [],
): Promise<string> {
  const root = await fs.mkdtemp(path.join(dir, 'run-'));
  await writeFiles(root, [...files, ...extra]);
  const tsconfigPath = path.join(root, 'tsconfig.json');
  await fs.writeFile(
    tsconfigPath,
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2023', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        noUncheckedIndexedAccess: true,
        verbatimModuleSyntax: true,
        skipLibCheck: true,
        noEmit: true,
        baseUrl: '.',
        paths: Object.fromEntries(
          NAMESPACES.map((ns) => [`${ns}/*`, [`./${ns}/*`]]),
        ),
        types: [],
      },
      include: NAMESPACES.concat('usage').map((d) => `${d}`),
    }),
  );
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
  });
  // Scoped to this package's own output and the usage fixture: `<ns>/react-tanstack/zod/*`
  // is `@kurotako/gen-zod`'s emitted code, which has its own test suite.
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => {
    const file = d.file?.fileName ?? '';
    return (
      !file.includes('/react-tanstack/zod/') &&
      (file.includes('/react-tanstack/') || file.includes('/usage/'))
    );
  });
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (f) => f,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  });
}

/** A consumer of the generated hooks: typed access, call-site schemas, server errors. */
const USAGE: VirtualFile = {
  path: 'usage/index.ts',
  content: `import { useField } from '@tanstack/react-form';
import { z } from 'zod';
import {
  defaultLoginDtoFormValues,
  useLoginDtoForm,
} from 'api/react-tanstack/LoginDto.form';
import type { LoginDtoFormApi } from 'api/react-tanstack/LoginDto.form';
import { LoginDtoSchema } from 'api/react-tanstack/zod/LoginDto.schema';
import { useRegisterDtoForm } from 'api/react-tanstack/RegisterDto.form';

export function plain(): LoginDtoFormApi {
  return useLoginDtoForm({
    defaultValues: { email: 'a@b.co' },
    validation: { mode: 'change', modeAfterSubmission: 'change' },
    onSubmit: ({ value }) => {
      const email: string = value.email;
      void email;
    },
    onSubmitInvalid: ({ value }) => {
      void value.password;
    },
  });
}

export function refined(): LoginDtoFormApi {
  return useLoginDtoForm({
    schema: LoginDtoSchema.refine((v) => v.password !== v.email, {
      message: 'must differ',
      path: ['password'],
    }),
  });
}

export function extended(): LoginDtoFormApi {
  return useLoginDtoForm({
    schema: LoginDtoSchema.extend({ remember: z.boolean() }),
  });
}

export function typed(): void {
  const form = useLoginDtoForm();
  form.setFieldValue('email', 'a@b.co');
  // @ts-expect-error not a field of LoginDto
  form.setFieldValue('nope', 'x');
  // @ts-expect-error email is a string
  form.setFieldValue('email', 1);
  // Server errors are set through the returned instance.
  form.setErrorMap({ onSubmit: { fields: { email: 'already used' } } });
  const values: { email: string; password: string } = defaultLoginDtoFormValues();
  void values;
}

export function errorMessages(): string[] {
  const form = useLoginDtoForm();
  const field = useField({ form, name: 'email' });
  return field.state.meta.errors.map((error) => error?.message ?? '');
}

export function dates(): void {
  const form = useRegisterDtoForm();
  form.setFieldValue('birthday', new Date());
}
`,
};

/** Nested paths only exist when relations are spelled out. */
const USAGE_DEEP: VirtualFile = {
  path: 'usage/deep.ts',
  content: `import { useOrderForm } from 'checkout/react-tanstack/Order.form';

export function nested(): void {
  const form = useOrderForm();
  form.setFieldValue('customer.name', 'Ada');
  form.setFieldValue('lines[0].sku', 'AB');
  // @ts-expect-error qty is a number
  form.setFieldValue('lines[0].qty', 'many');
}
`,
};

const cases: [string, Partial<ReactTanstackGeneratorOptions>, VirtualFile[]][] =
  [
    ['flat, full', {}, [USAGE]],
    ['flat, all variants', { variants: ['full', 'create', 'update'] }, [USAGE]],
    [
      'deep, all variants',
      { relations: 'deep', variants: ['full', 'create', 'update'] },
      [USAGE, USAGE_DEEP],
    ],
  ];

describe('generated hooks compile against the real @tanstack/react-form', () => {
  for (const [name, options, usage] of cases) {
    it(name, async () => {
      const ir = irOf(
        apiSource(),
        blogSource(),
        checkoutSource(),
        shopSource(),
      );
      const files = await generateFiles(ir, options);
      expect(await typecheck(files, usage)).toBe('');
    });
  }
});
