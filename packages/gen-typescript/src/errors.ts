/**
 * `@kurotako/gen-typescript` error classes.
 *
 * Codes: `typescript_alias_cycle`, `typescript_alias_public_name_collision`,
 * `typescript_enum_collision`, `typescript_enum_public_name_collision`.
 */
export class TypeScriptGenError extends Error {
  readonly code: string;

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Source aliases in a direct `ref` cycle cannot be represented by the emitted
 * pure TypeScript aliases.
 */
export class TypeScriptAliasCycleError extends TypeScriptGenError {
  readonly namespace: string;
  readonly aliasNames: string[];

  constructor(namespace: string, aliasNames: readonly string[]) {
    const sortedNames = [...aliasNames].sort((left, right) =>
      left.localeCompare(right),
    );
    super(
      'typescript_alias_cycle',
      `source type aliases ${sortedNames.map((name) => `'${name}'`).join(', ')} form a direct reference cycle in namespace '${namespace}'; pure TypeScript aliases cannot represent it`,
    );
    this.namespace = namespace;
    this.aliasNames = sortedNames;
  }
}

/** Source aliases cannot reuse a public identifier emitted by this generator. */
export class TypeScriptAliasPublicNameCollisionError extends TypeScriptGenError {
  readonly namespace: string;
  readonly names: string[];

  constructor(namespace: string, names: readonly string[]) {
    const sortedNames = [...names].sort((left, right) =>
      left.localeCompare(right),
    );
    super(
      'typescript_alias_public_name_collision',
      `source type aliases ${sortedNames.map((name) => `'${name}'`).join(', ')} collide with generated public identifiers in namespace '${namespace}'; rename one of the conflicting source definitions`,
    );
    this.namespace = namespace;
    this.names = sortedNames;
  }
}

/** An enum cannot reuse a non-enum identifier exported from the namespace barrel. */
export class TypeScriptEnumPublicNameCollisionError extends TypeScriptGenError {
  readonly namespace: string;
  readonly names: string[];

  constructor(namespace: string, names: readonly string[]) {
    const sortedNames = [...names].sort((left, right) =>
      left.localeCompare(right),
    );
    super(
      'typescript_enum_public_name_collision',
      `source enums ${sortedNames.map((name) => `'${name}'`).join(', ')} collide with other public identifiers in namespace '${namespace}'; rename one of the conflicting source definitions`,
    );
    this.namespace = namespace;
    this.names = sortedNames;
  }
}

/**
 * Two distinct `EnumDef`s reachable in one source share a name. Names both
 * origins so the schema author can resolve the collision.
 */
export class TypeScriptEnumCollisionError extends TypeScriptGenError {
  readonly enumName: string;
  readonly firstOrigin: string;
  readonly secondOrigin: string;

  constructor(enumName: string, firstOrigin: string, secondOrigin: string) {
    super(
      'typescript_enum_collision',
      `enum '${enumName}' is defined twice with different values (${firstOrigin} vs ${secondOrigin}); ` +
        'rename one of them in the source schema',
    );
    this.enumName = enumName;
    this.firstOrigin = firstOrigin;
    this.secondOrigin = secondOrigin;
  }
}
