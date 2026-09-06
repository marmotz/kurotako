/**
 * Fluent `SourceIR` builder with incremental validation.
 *
 * A parser builds one `SourceIR`; `@kurotako/core` merges them. Incremental
 * checks throw immediately with a located path (`pg.User.email`); `build()` runs
 * the full `assertSourceIR` as the final gate.
 */
import * as v from 'valibot';
import { ScalarTypeSchema } from './schemas.js';
import type {
  DefaultValue,
  Entity,
  EnumDef,
  EnumValue,
  Field,
  FieldType,
  IndexDef,
  IndexType,
  ReferentialAction,
  Relation,
  ScalarType,
  SourceIR,
  StringFormat,
  TypeAlias,
} from './types.js';
import { assertSourceIR, type IrIssue, IrValidationError } from './validate.js';

export class IrBuildError extends Error {
  readonly path: string;
  readonly issues: IrIssue[] | undefined;

  constructor(path: string, message: string, issues?: IrIssue[]) {
    super(`${path}: ${message}`);
    this.name = 'IrBuildError';
    this.path = path;
    this.issues = issues;
  }
}

// --- public builder interfaces -----------------------------------------------

export interface EnumBuilder {
  value(name: string, opts?: { dbName?: string; doc?: string }): this;
  doc(text: string): this;
  dbName(name: string): this;
}

/** Type-setters shared by `UnionBuilder` and `TypeAliasBuilder`. */
export interface TypeVariantBuilder {
  scalar(t: ScalarType): this;
  enum(ref: string): this;
  ref(name: string): this;
  union(build: (u: UnionBuilder) => void): this;
  unknown(hint?: string): this;
}

export interface UnionBuilder extends TypeVariantBuilder {
  /** `mapping` values must name a `ref` variant of this union. */
  discriminator(propertyName: string, mapping?: Record<string, string>): this;
}

export interface TypeAliasBuilder extends TypeVariantBuilder {
  doc(text: string): this;
}

export interface FieldBuilder {
  scalar(t: ScalarType): this;
  enum(ref: string): this;
  ref(name: string): this;
  union(build: (u: UnionBuilder) => void): this;
  unknown(hint?: string): this;
  list(): this;
  optional(): this;
  nullable(): this;
  primary(): this;
  unique(): this;
  min(n: number): this;
  max(n: number): this;
  minLength(n: number): this;
  maxLength(n: number): this;
  regex(src: string): this;
  format(f: StringFormat): this;
  default(d: DefaultValue): this;
  doc(text: string): this;
  dbName(name: string): this;
}

export interface RelationBuilder {
  to(namespace: string, entity: string): this;
  one(): this;
  many(): this;
  optional(): this;
  owning(): this;
  backRelation(name: string): this;
  fkFields(...fields: string[]): this;
  references(...fields: string[]): this;
  onDelete(action: ReferentialAction): this;
  onUpdate(action: ReferentialAction): this;
}

export interface EntityBuilder {
  field(name: string, def: (f: FieldBuilder) => void): this;
  relation(name: string, def: (r: RelationBuilder) => void): this;
  localEnum(name: string, def: (e: EnumBuilder) => void): this;
  primaryKey(...fields: string[]): this;
  index(fields: string[], opts?: { name?: string; type?: IndexType }): this;
  unique(fields: string[], opts?: { name?: string }): this;
  doc(text: string): this;
  dbName(name: string): this;
}

export interface SourceIrBuilder {
  addEnum(name: string, def: (e: EnumBuilder) => void): this;
  addEntity(name: string, def: (e: EntityBuilder) => void): this;
  addTypeAlias(name: string, def: (t: TypeAliasBuilder) => void): this;
  build(): SourceIR;
}

// --- implementations -----------------------------------------------------------

class EnumBuilderImpl implements EnumBuilder {
  #def: EnumDef;

  constructor(name: string) {
    this.#def = { name, values: [] };
  }

  value(name: string, opts?: { dbName?: string; doc?: string }): this {
    const entry: EnumValue = { name };
    if (opts?.dbName !== undefined) {
      entry.dbName = opts.dbName;
    }
    if (opts?.doc !== undefined) {
      entry.doc = opts.doc;
    }
    this.#def.values.push(entry);
    return this;
  }

  doc(text: string): this {
    this.#def.doc = text;
    return this;
  }

  dbName(name: string): this {
    this.#def.dbName = name;
    return this;
  }

  build(): EnumDef {
    return this.#def;
  }
}

function checkedScalar(path: string, t: ScalarType): FieldType {
  if (!v.is(ScalarTypeSchema, t)) {
    throw new IrBuildError(path, `unknown scalar type '${t}'`);
  }
  return { kind: 'scalar', scalar: t };
}

class UnionBuilderImpl implements UnionBuilder {
  #path: string;
  #variants: FieldType[] = [];
  #discriminator:
    | { propertyName: string; mapping?: Record<string, string> }
    | undefined;

  constructor(path: string) {
    this.#path = path;
  }

  scalar(t: ScalarType): this {
    this.#variants.push(checkedScalar(this.#path, t));
    return this;
  }

  enum(ref: string): this {
    this.#variants.push({ kind: 'enum', ref });
    return this;
  }

  ref(name: string): this {
    this.#variants.push({ kind: 'ref', ref: name });
    return this;
  }

  union(build: (u: UnionBuilder) => void): this {
    const nested = new UnionBuilderImpl(this.#path);
    build(nested);
    // Nested unions are flattened into this one on build.
    for (const variant of nested.#variants) {
      this.#variants.push(variant);
    }
    return this;
  }

  unknown(hint?: string): this {
    this.#variants.push(
      hint === undefined ? { kind: 'unknown' } : { kind: 'unknown', hint },
    );
    return this;
  }

  discriminator(propertyName: string, mapping?: Record<string, string>): this {
    this.#discriminator =
      mapping === undefined ? { propertyName } : { propertyName, mapping };
    return this;
  }

  build(): Extract<FieldType, { kind: 'union' }> {
    if (this.#variants.length < 2) {
      throw new IrBuildError(
        this.#path,
        `union() needs at least 2 variants, got ${this.#variants.length}`,
      );
    }
    const mapping = this.#discriminator?.mapping;
    if (mapping !== undefined) {
      const refVariants = new Set(
        this.#variants.flatMap((vv) => (vv.kind === 'ref' ? [vv.ref] : [])),
      );
      for (const [key, target] of Object.entries(mapping)) {
        if (!refVariants.has(target)) {
          throw new IrBuildError(
            this.#path,
            `discriminator mapping '${key}' -> '${target}' names no ref variant`,
          );
        }
      }
    }
    const type: Extract<FieldType, { kind: 'union' }> = {
      kind: 'union',
      variants: this.#variants,
    };
    if (this.#discriminator !== undefined) {
      type.discriminator = this.#discriminator;
    }
    return type;
  }
}

class TypeAliasBuilderImpl implements TypeAliasBuilder {
  #path: string;
  #name: string;
  #type: FieldType = { kind: 'unknown' };
  #doc: string | undefined;

  constructor(path: string, name: string) {
    this.#path = path;
    this.#name = name;
  }

  scalar(t: ScalarType): this {
    this.#type = checkedScalar(this.#path, t);
    return this;
  }

  enum(ref: string): this {
    this.#type = { kind: 'enum', ref };
    return this;
  }

  ref(name: string): this {
    this.#type = { kind: 'ref', ref: name };
    return this;
  }

  union(build: (u: UnionBuilder) => void): this {
    const nested = new UnionBuilderImpl(this.#path);
    build(nested);
    this.#type = nested.build();
    return this;
  }

  unknown(hint?: string): this {
    this.#type =
      hint === undefined ? { kind: 'unknown' } : { kind: 'unknown', hint };
    return this;
  }

  doc(text: string): this {
    this.#doc = text;
    return this;
  }

  build(): TypeAlias {
    const alias: TypeAlias = { name: this.#name, type: this.#type };
    if (this.#doc !== undefined) {
      alias.doc = this.#doc;
    }
    return alias;
  }
}

class FieldBuilderImpl implements FieldBuilder {
  #path: string;
  #field: Field;
  #onPrimary: (name: string) => void;

  constructor(path: string, name: string, onPrimary: (name: string) => void) {
    this.#path = path;
    this.#onPrimary = onPrimary;
    this.#field = {
      name,
      type: { kind: 'unknown' },
      list: false,
      optional: false,
      nullable: false,
      constraints: {},
    };
  }

  scalar(t: ScalarType): this {
    if (!v.is(ScalarTypeSchema, t)) {
      throw new IrBuildError(this.#path, `unknown scalar type '${t}'`);
    }
    this.#field.type = { kind: 'scalar', scalar: t };
    return this;
  }

  enum(ref: string): this {
    this.#field.type = { kind: 'enum', ref };
    return this;
  }

  ref(name: string): this {
    this.#field.type = { kind: 'ref', ref: name };
    return this;
  }

  union(build: (u: UnionBuilder) => void): this {
    const builder = new UnionBuilderImpl(this.#path);
    build(builder);
    this.#field.type = builder.build();
    return this;
  }

  unknown(hint?: string): this {
    this.#field.type =
      hint === undefined ? { kind: 'unknown' } : { kind: 'unknown', hint };
    return this;
  }

  list(): this {
    this.#field.list = true;
    return this;
  }

  optional(): this {
    this.#field.optional = true;
    return this;
  }

  nullable(): this {
    this.#field.nullable = true;
    return this;
  }

  primary(): this {
    if (this.#field.list) {
      throw new IrBuildError(
        this.#path,
        'primary() cannot be used on a list field',
      );
    }
    this.#onPrimary(this.#field.name);
    return this;
  }

  unique(): this {
    this.#field.constraints.unique = true;
    return this;
  }

  min(n: number): this {
    this.#field.constraints.min = n;
    return this;
  }

  max(n: number): this {
    this.#field.constraints.max = n;
    return this;
  }

  minLength(n: number): this {
    this.#field.constraints.minLength = n;
    return this;
  }

  maxLength(n: number): this {
    this.#field.constraints.maxLength = n;
    return this;
  }

  regex(src: string): this {
    this.#field.constraints.regex = src;
    return this;
  }

  format(f: StringFormat): this {
    if (
      this.#field.type.kind !== 'scalar' ||
      this.#field.type.scalar !== 'string'
    ) {
      throw new IrBuildError(
        this.#path,
        'format() requires a string scalar field',
      );
    }
    this.#field.constraints.format = f;
    return this;
  }

  default(d: DefaultValue): this {
    this.#field.default = d;
    return this;
  }

  doc(text: string): this {
    this.#field.doc = text;
    return this;
  }

  dbName(name: string): this {
    this.#field.dbName = name;
    return this;
  }

  build(): Field {
    return this.#field;
  }
}

class RelationBuilderImpl implements RelationBuilder {
  #rel: Relation;

  constructor(name: string) {
    this.#rel = {
      name,
      target: { namespace: '', entity: '' },
      cardinality: 'one',
      optional: false,
      owning: false,
    };
  }

  to(namespace: string, entity: string): this {
    this.#rel.target = { namespace, entity };
    return this;
  }

  one(): this {
    this.#rel.cardinality = 'one';
    return this;
  }

  many(): this {
    this.#rel.cardinality = 'many';
    return this;
  }

  optional(): this {
    this.#rel.optional = true;
    return this;
  }

  owning(): this {
    this.#rel.owning = true;
    return this;
  }

  backRelation(name: string): this {
    this.#rel.backRelation = name;
    return this;
  }

  fkFields(...fields: string[]): this {
    this.#rel.fkFields = fields;
    return this;
  }

  references(...fields: string[]): this {
    this.#rel.references = fields;
    return this;
  }

  onDelete(action: ReferentialAction): this {
    this.#rel.onDelete = action;
    return this;
  }

  onUpdate(action: ReferentialAction): this {
    this.#rel.onUpdate = action;
    return this;
  }

  build(): Relation {
    return this.#rel;
  }
}

class EntityBuilderImpl implements EntityBuilder {
  #namespace: string;
  #name: string;
  #fields: FieldBuilderImpl[] = [];
  #fieldNames = new Set<string>();
  #relations: RelationBuilderImpl[] = [];
  #localEnums: Record<string, EnumDef> = {};
  #primaryKey: string[] = [];
  #indexes: IndexDef[] = [];
  #uniques: { fields: string[]; name?: string }[] = [];
  #doc: string | undefined;
  #dbName: string | undefined;

  constructor(namespace: string, name: string) {
    this.#namespace = namespace;
    this.#name = name;
  }

  #addPrimary(field: string): void {
    if (!this.#primaryKey.includes(field)) {
      this.#primaryKey.push(field);
    }
  }

  field(name: string, def: (f: FieldBuilder) => void): this {
    if (this.#fieldNames.has(name)) {
      throw new IrBuildError(
        `${this.#namespace}.${this.#name}.${name}`,
        `duplicate field '${name}'`,
      );
    }
    this.#fieldNames.add(name);
    const builder = new FieldBuilderImpl(
      `${this.#namespace}.${this.#name}.${name}`,
      name,
      (pk) => this.#addPrimary(pk),
    );
    def(builder);
    this.#fields.push(builder);
    return this;
  }

  relation(name: string, def: (r: RelationBuilder) => void): this {
    const builder = new RelationBuilderImpl(name);
    def(builder);
    this.#relations.push(builder);
    return this;
  }

  localEnum(name: string, def: (e: EnumBuilder) => void): this {
    const builder = new EnumBuilderImpl(name);
    def(builder);
    this.#localEnums[name] = builder.build();
    return this;
  }

  primaryKey(...fields: string[]): this {
    for (const field of fields) {
      this.#addPrimary(field);
    }
    return this;
  }

  index(fields: string[], opts?: { name?: string; type?: IndexType }): this {
    const idx: IndexDef = { fields };
    if (opts?.name !== undefined) {
      idx.name = opts.name;
    }
    if (opts?.type !== undefined) {
      idx.type = opts.type;
    }
    this.#indexes.push(idx);
    return this;
  }

  unique(fields: string[], opts?: { name?: string }): this {
    const entry: { fields: string[]; name?: string } = { fields };
    if (opts?.name !== undefined) {
      entry.name = opts.name;
    }
    this.#uniques.push(entry);
    return this;
  }

  doc(text: string): this {
    this.#doc = text;
    return this;
  }

  dbName(name: string): this {
    this.#dbName = name;
    return this;
  }

  build(): Entity {
    const entity: Entity = {
      name: this.#name,
      fields: this.#fields.map((f) => f.build()),
      relations: this.#relations.map((r) => r.build()),
      indexes: this.#indexes,
      uniques: this.#uniques,
    };
    if (Object.keys(this.#localEnums).length > 0) {
      entity.enums = this.#localEnums;
    }
    if (this.#primaryKey.length > 0) {
      entity.primaryKey = this.#primaryKey;
    }
    if (this.#doc !== undefined) {
      entity.doc = this.#doc;
    }
    if (this.#dbName !== undefined) {
      entity.dbName = this.#dbName;
    }
    return entity;
  }
}

class SourceIrBuilderImpl implements SourceIrBuilder {
  #namespace: string;
  #parser: string;
  #parserVersion: string | undefined;
  #entities: EntityBuilderImpl[] = [];
  #entityNames = new Set<string>();
  #enums: Record<string, EnumDef> = {};
  #typeAliases: Record<string, TypeAlias> = {};

  constructor(init: {
    namespace: string;
    parser: string;
    parserVersion?: string;
  }) {
    this.#namespace = init.namespace;
    this.#parser = init.parser;
    this.#parserVersion = init.parserVersion;
  }

  addEnum(name: string, def: (e: EnumBuilder) => void): this {
    const builder = new EnumBuilderImpl(name);
    def(builder);
    this.#enums[name] = builder.build();
    return this;
  }

  addEntity(name: string, def: (e: EntityBuilder) => void): this {
    if (this.#entityNames.has(name)) {
      throw new IrBuildError(
        `${this.#namespace}.${name}`,
        `duplicate entity '${name}'`,
      );
    }
    this.#entityNames.add(name);
    const builder = new EntityBuilderImpl(this.#namespace, name);
    def(builder);
    this.#entities.push(builder);
    return this;
  }

  addTypeAlias(name: string, def: (t: TypeAliasBuilder) => void): this {
    if (name in this.#typeAliases) {
      throw new IrBuildError(
        `${this.#namespace}.typeAliases.${name}`,
        `duplicate type alias '${name}'`,
      );
    }
    const builder = new TypeAliasBuilderImpl(
      `${this.#namespace}.typeAliases.${name}`,
      name,
    );
    def(builder);
    this.#typeAliases[name] = builder.build();
    return this;
  }

  build(): SourceIR {
    const source: SourceIR = {
      namespace: this.#namespace,
      parser: this.#parser,
      entities: Object.fromEntries(
        this.#entities.map((e) => {
          const built = e.build();
          return [built.name, built];
        }),
      ),
      enums: this.#enums,
    };
    if (this.#parserVersion !== undefined) {
      source.parserVersion = this.#parserVersion;
    }
    if (Object.keys(this.#typeAliases).length > 0) {
      source.typeAliases = this.#typeAliases;
    }

    try {
      assertSourceIR(source);
    } catch (err) {
      if (err instanceof IrValidationError) {
        const first = err.issues[0];
        throw new IrBuildError(
          first?.path ?? this.#namespace,
          first?.message ?? 'invalid SourceIR',
          err.issues,
        );
      }
      throw err;
    }
    return source;
  }
}

export function createSourceIR(init: {
  namespace: string;
  parser: string;
  parserVersion?: string;
}): SourceIrBuilder {
  return new SourceIrBuilderImpl(init);
}
