import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createSourceIR } from '@kurotako/ir';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import {
  TypeScriptAliasCycleError,
  TypeScriptAliasPublicNameCollisionError,
  TypeScriptEnumPublicNameCollisionError,
} from './errors.js';
import { typescriptGenerator } from './generator.js';
import { fileEndingWith, noopLogger, runGenerator } from './testing/helpers.js';
import { blogSource, irOf } from './testing/ir.js';

describe('typescriptGenerator.generate', () => {
  it('emits the complete source tree and usable artifact end to end', () => {
    const output = runGenerator(irOf(blogSource()));
    expect(typescriptGenerator.name).toBe('typescript');
    expect(output.files.map((file) => file.path)).toEqual([
      'blog/typescript/scalars.ts',
      'blog/typescript/enums.ts',
      'blog/typescript/filters.ts',
      'blog/typescript/User.type.ts',
      'blog/typescript/Post.type.ts',
      'blog/typescript/index.ts',
    ]);
    expect(fileEndingWith(output.files, 'scalars.ts')).toContain('JsonValue');
    expect(fileEndingWith(output.files, 'index.ts')).toContain(
      "export * from './enums';",
    );
    expect(output.artifact.entities['blog.Post']?.module).toBe(
      'blog/typescript/Post.type',
    );
  });

  it('is deterministic and preserves source entity and field order', () => {
    const ir = irOf(blogSource());
    expect(runGenerator(ir)).toEqual(runGenerator(ir));
    const user = fileEndingWith(runGenerator(ir).files, 'User.type.ts');
    const full = user.slice(
      user.indexOf('export type UserDto'),
      user.indexOf('export type UserDeepDto'),
    );
    const positions = ['id', 'email', 'role', 'meta', 'mystery'].map((name) =>
      full.indexOf(`${name}`),
    );
    expect(positions).toEqual(
      [...positions].sort((left, right) => left - right),
    );
  });

  it('typechecks mutually recursive deep relation declarations', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kurotako-typescript-'));
    try {
      const files = runGenerator(irOf(blogSource())).files;
      const paths = files.map((file) => join(directory, file.path));
      for (const [index, file] of files.entries()) {
        const path = paths[index];
        if (path === undefined) throw new Error('missing generated path');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
      }
      const program = ts.createProgram(paths, {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
      });
      expect(ts.getPreEmitDiagnostics(program)).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('renders and typechecks direct and union refs to entities and aliases', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kurotako-typescript-'));
    try {
      const source = createSourceIR({ namespace: 'shop', parser: 'test' })
        .addTypeAlias('Delivery', (alias) =>
          alias.union((union) => union.ref('Address').scalar('string')),
        )
        .addEntity('Address', (entity) => {
          entity.field('line1', (field) => field.scalar('string'));
          entity.field('delivery', (field) => field.ref('Delivery'));
        })
        .addEntity('Invoice', (entity) => {
          entity.field('address', (field) => field.ref('Address'));
          entity.field('destination', (field) =>
            field.union((union) => union.ref('Address').ref('Delivery')),
          );
        })
        .build();
      const files = runGenerator(irOf(source)).files;
      const invoice = fileEndingWith(files, 'Invoice.type.ts');
      const aliases = fileEndingWith(files, 'aliases.ts');

      expect(invoice).toContain("import type { Delivery } from './aliases';");
      expect(invoice).toContain(
        "import type { AddressDto } from './Address.type';",
      );
      expect(invoice).toContain('address: AddressDto;');
      expect(invoice).toContain('destination: AddressDto | Delivery;');
      expect(aliases).toContain(
        "import type { AddressDto } from './Address.type';",
      );
      expect(aliases).toContain('export type Delivery = AddressDto | string;');
      expect(fileEndingWith(files, 'index.ts')).toContain(
        "export type * from './aliases';",
      );

      const imports = invoice
        .split('\n')
        .filter((line) => line.startsWith('import type'));
      const specifiers = imports.map(
        (line) => line.match(/from '([^']+)'/)?.[1] ?? '',
      );
      expect(specifiers).toEqual(
        [...specifiers].sort((left, right) => left.localeCompare(right)),
      );

      const paths = files.map((file) => join(directory, file.path));
      for (const [index, file] of files.entries()) {
        const path = paths[index];
        if (path === undefined) throw new Error('missing generated path');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
      }
      const program = ts.createProgram(paths, {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
      });
      expect(ts.getPreEmitDiagnostics(program)).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('renders flattened empty unions as unknown for aliases', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addTypeAlias('Empty', (alias) => alias.scalar('string'))
      .build();
    const alias = source.typeAliases?.Empty;
    if (alias === undefined) throw new Error('missing Empty alias');
    alias.type = {
      kind: 'union',
      variants: [{ kind: 'union', variants: [] }],
    };

    const aliases = fileEndingWith(
      runGenerator(irOf(source)).files,
      'aliases.ts',
    );
    expect(aliases).toContain('export type Empty = unknown;');
  });

  it('rejects direct source type alias cycles before emitting TS2456', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addTypeAlias('Left', (alias) => alias.ref('Right'))
      .addTypeAlias('Right', (alias) =>
        alias.union((union) => union.ref('Left').scalar('string')),
      )
      .build();

    expect(() => runGenerator(irOf(source))).toThrow(TypeScriptAliasCycleError);
    try {
      runGenerator(irOf(source));
    } catch (error) {
      expect(error).toMatchObject({
        code: 'typescript_alias_cycle',
        namespace: 'shop',
        aliasNames: ['Left', 'Right'],
      });
    }
  });

  it('keeps entity-only recursive references valid', () => {
    const directory = mkdtempSync(join(tmpdir(), 'kurotako-typescript-'));
    try {
      const source = createSourceIR({ namespace: 'tree', parser: 'test' })
        .addEntity('Node', (entity) => {
          entity.field('parent', (field) => field.ref('Node').optional());
        })
        .build();
      const files = runGenerator(irOf(source)).files;
      expect(fileEndingWith(files, 'Node.type.ts')).toContain(
        'parent?: NodeDto;',
      );

      const paths = files.map((file) => join(directory, file.path));
      for (const [index, file] of files.entries()) {
        const path = paths[index];
        if (path === undefined) throw new Error('missing generated path');
        mkdirSync(dirname(path), { recursive: true });
        writeFileSync(path, file.content);
      }
      const program = ts.createProgram(paths, {
        module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler,
        noEmit: true,
        strict: true,
        target: ts.ScriptTarget.ES2022,
      });
      expect(ts.getPreEmitDiagnostics(program)).toEqual([]);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it('rejects source type aliases that collide with emitted enum public names', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEnum('Status', (enumeration) => enumeration.value('OPEN'))
      .addTypeAlias('Status', (alias) => alias.scalar('string'))
      .build();

    expect(() => runGenerator(irOf(source))).toThrow(
      TypeScriptAliasPublicNameCollisionError,
    );
    try {
      runGenerator(irOf(source));
    } catch (error) {
      expect(error).toMatchObject({
        code: 'typescript_alias_public_name_collision',
        namespace: 'shop',
        names: ['Status'],
      });
    }
  });

  it.each([
    'UserDto',
    'UserDeepDto',
    'UserCreateDto',
    'UserCreateDeepDto',
    'UserUpdateDto',
    'UserUpdateDeepDto',
    'UserWhereDto',
    'UserWhereDeepDto',
    'UserSelectDto',
    'UserSelectDeepDto',
  ])('rejects alias %s when User emits that DTO variant family', (name) => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addTypeAlias(name, (alias) => alias.scalar('string'))
      .addEntity('User', () => {})
      .build();

    expect(() => runGenerator(irOf(source))).toThrow(
      TypeScriptAliasPublicNameCollisionError,
    );
  });

  it('rejects source type aliases that collide with emitted filter interfaces', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addTypeAlias('StringFilter', (alias) => alias.scalar('string'))
      .addEntity('User', (entity) => {
        entity.field('name', (field) => field.scalar('string'));
      })
      .build();

    expect(() => runGenerator(irOf(source))).toThrow(
      TypeScriptAliasPublicNameCollisionError,
    );
  });

  it('rejects source aliases that collide with the emitted JsonValue helper', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addTypeAlias('JsonValue', (alias) => alias.scalar('json'))
      .build();

    expect(() => runGenerator(irOf(source))).toThrow(
      TypeScriptAliasPublicNameCollisionError,
    );
  });

  it.each([
    'UserDto',
    'UserDeepDto',
    'UserCreateDto',
    'UserCreateDeepDto',
    'UserUpdateDto',
    'UserUpdateDeepDto',
    'UserWhereDto',
    'UserWhereDeepDto',
    'UserSelectDto',
    'UserSelectDeepDto',
    'StringFilter',
    'EnumRoleFilter',
    'JsonValue',
    'Delivery',
  ])('rejects enum %s when it collides with another public type', (name) => {
    const builder = createSourceIR({
      namespace: 'shop',
      parser: 'test',
    }).addEnum(name, (enumeration) => enumeration.value('OPEN'));
    if (name === 'StringFilter') {
      builder.addEntity('User', (entity) => {
        entity.field('name', (field) => field.scalar('string'));
      });
    } else if (name === 'EnumRoleFilter') {
      builder
        .addEnum('Role', (enumeration) => enumeration.value('USER'))
        .addEntity('User', (entity) => {
          entity.field('role', (field) => field.enum('Role'));
        });
    } else if (name === 'JsonValue') {
      builder.addEntity('User', (entity) => {
        entity.field('metadata', (field) => field.scalar('json'));
      });
    } else if (name === 'Delivery') {
      builder.addTypeAlias('Delivery', (alias) => alias.scalar('string'));
    } else {
      builder.addEntity('User', () => {});
    }

    expect(() => runGenerator(irOf(builder.build()))).toThrow(
      name === 'Delivery'
        ? TypeScriptAliasPublicNameCollisionError
        : TypeScriptEnumPublicNameCollisionError,
    );
  });

  it('permits an emitted enum const and type to share their identifier', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEnum('Status', (enumeration) => enumeration.value('OPEN'))
      .build();

    expect(() => runGenerator(irOf(source))).not.toThrow();
  });

  it('degrades cross-source deep relations while retaining the FK field and debug log', () => {
    const source = createSourceIR({ namespace: 'shop', parser: 'test' })
      .addEntity('Order', (entity) => {
        entity.field('customerId', (field) => field.scalar('uuid'));
        entity.relation('customer', (relation) =>
          relation.to('crm', 'Customer').one(),
        );
      })
      .build();
    const debug = vi.fn();
    const output = runGenerator(irOf(source), { ...noopLogger, debug });
    const entity = fileEndingWith(output.files, 'Order.type.ts');
    const deep = entity.slice(
      entity.indexOf('export type OrderDeepDto'),
      entity.indexOf('export type OrderCreateDto'),
    );
    expect(deep).toContain('customerId: string;');
    expect(deep).not.toContain('customer:');
    expect(debug).toHaveBeenCalled();
  });
});
