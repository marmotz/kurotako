/**
 * Runtime validation of the IR.
 *
 * Schema-first: `v.safeParse` against `schemas.ts` covers structural shape,
 * closed-union membership, required/optional keys and tagged-union narrowing.
 * This module adds the cross-reference pass — the checks Valibot cannot express
 * structurally (enum-ref resolution, relation-target / back-relation resolution,
 * field-name references, `min <= max`, regex compilation, key/name invariants).
 *
 * Valibot issues and cross-ref issues are both normalised to the stable
 * `IrIssue` surface (dotted, located paths) so consumers are unaffected.
 */
import * as v from 'valibot';
import { IrSchema, SourceIrSchema } from './schemas.js';
import type { Constraints, Entity, FieldType, IR, SourceIR } from './types.js';
import { IR_VERSION, isCompatible } from './version.js';

export type IrIssueCode =
  | 'version_incompatible'
  | 'namespace_key_mismatch'
  | 'entity_key_mismatch'
  | 'duplicate_field'
  | 'duplicate_enum_value'
  | 'unresolved_enum_ref'
  | 'unresolved_field_ref'
  | 'unresolved_relation_target'
  | 'unresolved_back_relation'
  | 'unresolved_ref'
  | 'unresolved_type_alias'
  | 'type_alias_key_mismatch'
  | 'degenerate_union'
  | 'union_cycle'
  | 'invalid_constraint'
  | 'invalid_regex'
  | 'shape';

export interface IrIssue {
  path: string;
  code: IrIssueCode;
  message: string;
}

export type IrValidation<T> =
  | { ok: true; value: T; info?: IrIssue[] }
  | { ok: false; issues: IrIssue[] };

export class IrValidationError extends Error {
  readonly issues: IrIssue[];

  constructor(issues: IrIssue[]) {
    const detail = issues
      .map((i) => `${i.path === '' ? '<root>' : i.path}: ${i.message}`)
      .join('; ');
    super(`invalid IR: ${detail}`);
    this.name = 'IrValidationError';
    this.issues = issues;
  }
}

function normaliseValibotIssues(
  issues: readonly v.BaseIssue<unknown>[],
): IrIssue[] {
  return issues.map((issue) => ({
    path: v.getDotPath(issue) ?? '',
    code: 'shape' as const,
    message: issue.message,
  }));
}

function pushIssue(
  issues: IrIssue[],
  path: string,
  code: IrIssueCode,
  message: string,
): void {
  issues.push({ path, code, message });
}

function checkConstraints(
  issues: IrIssue[],
  path: string,
  c: Constraints,
): void {
  if (c.min !== undefined && c.max !== undefined && c.min > c.max) {
    pushIssue(
      issues,
      path,
      'invalid_constraint',
      `min (${c.min}) is greater than max (${c.max})`,
    );
  }
  if (
    c.minLength !== undefined &&
    c.maxLength !== undefined &&
    c.minLength > c.maxLength
  ) {
    pushIssue(
      issues,
      path,
      'invalid_constraint',
      `minLength (${c.minLength}) is greater than maxLength (${c.maxLength})`,
    );
  }
  if (c.regex !== undefined) {
    try {
      new RegExp(c.regex);
    } catch {
      pushIssue(
        issues,
        path,
        'invalid_regex',
        `regex does not compile: ${c.regex}`,
      );
    }
  }
}

function checkEnumValues(
  issues: IrIssue[],
  path: string,
  values: readonly { name: string }[],
): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value.name)) {
      pushIssue(
        issues,
        `${path}.${value.name}`,
        'duplicate_enum_value',
        `duplicate enum value '${value.name}'`,
      );
    }
    seen.add(value.name);
  }
}

/**
 * Recursive field-type check. `enum` keeps its entity-local → source-level
 * resolution; `ref` must resolve against `source.entities` then
 * `source.typeAliases`; `union` recurses into every variant and, when it carries
 * a `discriminator.mapping`, every value must name a `ref` variant of the union.
 * A union with fewer than two variants is tolerated on read — it feeds the
 * non-fatal `info` channel (`degenerate_union`), not `issues`.
 */
function walkFieldType(
  type: FieldType,
  path: string,
  entity: Entity | undefined,
  source: SourceIR,
  issues: IrIssue[],
  info: IrIssue[],
): void {
  switch (type.kind) {
    case 'scalar':
    case 'unknown':
      return;
    case 'enum': {
      const resolved = entity?.enums?.[type.ref] ?? source.enums[type.ref];
      if (resolved === undefined) {
        pushIssue(
          issues,
          path,
          'unresolved_enum_ref',
          `field type references unknown enum '${type.ref}'`,
        );
      }
      return;
    }
    case 'ref': {
      const known =
        source.entities[type.ref] !== undefined ||
        source.typeAliases?.[type.ref] !== undefined;
      if (!known) {
        pushIssue(
          issues,
          path,
          'unresolved_ref',
          `ref '${type.ref}' resolves to no entity and no type alias`,
        );
      }
      return;
    }
    case 'union': {
      if (type.variants.length < 2) {
        pushIssue(
          info,
          path,
          'degenerate_union',
          `union has ${type.variants.length} variant(s); expected at least 2`,
        );
      }
      type.variants.forEach((variant, i) => {
        walkFieldType(
          variant,
          `${path}.variants.${i}`,
          entity,
          source,
          issues,
          info,
        );
      });
      const mapping = type.discriminator?.mapping;
      if (mapping !== undefined) {
        const refVariants = new Set(
          type.variants.flatMap((vv) => (vv.kind === 'ref' ? [vv.ref] : [])),
        );
        for (const [key, target] of Object.entries(mapping)) {
          if (!refVariants.has(target)) {
            pushIssue(
              issues,
              `${path}.discriminator.mapping.${key}`,
              'unresolved_type_alias',
              `discriminator mapping '${key}' -> '${target}' names no ref variant of the union`,
            );
          }
        }
      }
      return;
    }
  }
}

/** Every `ref` name reachable from a field type, following nested unions. */
function collectRefs(type: FieldType, out: Set<string>): void {
  if (type.kind === 'ref') {
    out.add(type.ref);
  } else if (type.kind === 'union') {
    for (const variant of type.variants) {
      collectRefs(variant, out);
    }
  }
}

/**
 * Informational cycle detection over `ref` edges (entity fields, alias types,
 * union variants). Recursion is allowed — a cycle never produces a fatal issue,
 * it only feeds the `info` channel (`union_cycle`) so a generator can log it and
 * fall back to a lazy reference.
 */
function checkRefCycles(
  namespace: string,
  source: SourceIR,
  info: IrIssue[],
): void {
  const adjacency = new Map<string, Set<string>>();
  for (const [key, alias] of Object.entries(source.typeAliases ?? {})) {
    const refs = new Set<string>();
    collectRefs(alias.type, refs);
    adjacency.set(key, refs);
  }
  for (const [key, entity] of Object.entries(source.entities)) {
    const refs = adjacency.get(key) ?? new Set<string>();
    for (const field of entity.fields) {
      collectRefs(field.type, refs);
    }
    adjacency.set(key, refs);
  }

  const state = new Map<string, 'gray' | 'black'>();
  const stack: string[] = [];
  const reported = new Set<string>();

  const visit = (node: string): void => {
    state.set(node, 'gray');
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!adjacency.has(next)) {
        continue;
      }
      const seen = state.get(next);
      if (seen === 'gray') {
        const cycle = stack.slice(stack.indexOf(next));
        const signature = [...cycle].sort().join('|');
        if (!reported.has(signature)) {
          reported.add(signature);
          pushIssue(
            info,
            namespace,
            'union_cycle',
            `reference cycle: ${[...cycle, next].join(' -> ')}`,
          );
        }
      } else if (seen === undefined) {
        visit(next);
      }
    }
    stack.pop();
    state.set(node, 'black');
  };

  for (const node of adjacency.keys()) {
    if (state.get(node) === undefined) {
      visit(node);
    }
  }
}

/**
 * Run every cross-reference check on one source. `lookupEntity` and
 * `isNamespacePresent` give access to the cross-namespace view (full in
 * `validateIR`, this-source-only in `validateSourceIR`). Non-fatal observations
 * (degenerate unions, reference cycles) are collected in `info`.
 */
function checkSource(
  namespace: string,
  source: SourceIR,
  lookupEntity: (ns: string, name: string) => Entity | undefined,
  isNamespacePresent: (ns: string) => boolean,
  issues: IrIssue[],
  info: IrIssue[],
): void {
  for (const [key, def] of Object.entries(source.enums)) {
    if (def.name !== key) {
      pushIssue(
        issues,
        `${namespace}.enums.${key}`,
        'entity_key_mismatch',
        `enum key '${key}' does not match enum name '${def.name}'`,
      );
    }
    checkEnumValues(issues, `${namespace}.enums.${key}`, def.values);
  }

  for (const [key, entity] of Object.entries(source.entities)) {
    const ePath = `${namespace}.${key}`;
    if (entity.name !== key) {
      pushIssue(
        issues,
        ePath,
        'entity_key_mismatch',
        `entity key '${key}' does not match entity name '${entity.name}'`,
      );
    }

    const fieldNames = new Set<string>();
    for (const field of entity.fields) {
      const fPath = `${ePath}.${field.name}`;
      if (fieldNames.has(field.name)) {
        pushIssue(
          issues,
          fPath,
          'duplicate_field',
          `duplicate field '${field.name}'`,
        );
      }
      fieldNames.add(field.name);
      checkConstraints(issues, `${fPath}.constraints`, field.constraints);
      walkFieldType(field.type, fPath, entity, source, issues, info);
    }

    for (const [localKey, def] of Object.entries(entity.enums ?? {})) {
      if (def.name !== localKey) {
        pushIssue(
          issues,
          `${ePath}.enums.${localKey}`,
          'entity_key_mismatch',
          `local enum key '${localKey}' does not match name '${def.name}'`,
        );
      }
      checkEnumValues(issues, `${ePath}.enums.${localKey}`, def.values);
    }

    const hasField = (name: string): boolean => fieldNames.has(name);

    for (const pk of entity.primaryKey ?? []) {
      if (!hasField(pk)) {
        pushIssue(
          issues,
          `${ePath}.primaryKey`,
          'unresolved_field_ref',
          `primaryKey references unknown field '${pk}'`,
        );
      }
    }
    entity.indexes.forEach((idx, i) => {
      for (const f of idx.fields) {
        if (!hasField(f)) {
          pushIssue(
            issues,
            `${ePath}.indexes.${i}`,
            'unresolved_field_ref',
            `index references unknown field '${f}'`,
          );
        }
      }
    });
    entity.uniques.forEach((u, i) => {
      for (const f of u.fields) {
        if (!hasField(f)) {
          pushIssue(
            issues,
            `${ePath}.uniques.${i}`,
            'unresolved_field_ref',
            `unique references unknown field '${f}'`,
          );
        }
      }
    });

    entity.relations.forEach((rel, i) => {
      const rPath = `${ePath}.relations.${rel.name === '' ? i : rel.name}`;

      for (const fk of rel.fkFields ?? []) {
        if (!hasField(fk)) {
          pushIssue(
            issues,
            rPath,
            'unresolved_field_ref',
            `relation '${rel.name}' fkField references unknown field '${fk}'`,
          );
        }
      }

      const targetNs = rel.target.namespace;
      // Namespace absent: informational only, v1 drivers ignore cross-source.
      if (targetNs === '') {
        return;
      }
      const sameNs = targetNs === namespace;
      if (!sameNs && !isNamespacePresent(targetNs)) {
        // Other namespace, not present in this view: ignored (shape-level info).
        return;
      }

      const targetEntity = lookupEntity(targetNs, rel.target.entity);
      if (targetEntity === undefined) {
        pushIssue(
          issues,
          rPath,
          'unresolved_relation_target',
          `relation '${rel.name}' target ${targetNs}.${rel.target.entity} does not exist`,
        );
        return;
      }
      if (
        rel.backRelation !== undefined &&
        !targetEntity.relations.some((r) => r.name === rel.backRelation)
      ) {
        pushIssue(
          issues,
          rPath,
          'unresolved_back_relation',
          `backRelation '${rel.backRelation}' not found on ${targetNs}.${rel.target.entity}`,
        );
      }
      for (const ref of rel.references ?? []) {
        if (!targetEntity.fields.some((f) => f.name === ref)) {
          pushIssue(
            issues,
            rPath,
            'unresolved_field_ref',
            `relation '${rel.name}' references unknown field '${ref}' on ${targetNs}.${rel.target.entity}`,
          );
        }
      }
    });
  }

  for (const [key, alias] of Object.entries(source.typeAliases ?? {})) {
    const aPath = `${namespace}.typeAliases.${key}`;
    if (alias.name !== key) {
      pushIssue(
        issues,
        aPath,
        'type_alias_key_mismatch',
        `type alias key '${key}' does not match name '${alias.name}'`,
      );
    }
    walkFieldType(alias.type, `${aPath}.type`, undefined, source, issues, info);
  }

  checkRefCycles(namespace, source, info);
}

export function validateSourceIR(value: unknown): IrValidation<SourceIR> {
  const parsed = v.safeParse(SourceIrSchema, value);
  if (!parsed.success) {
    return { ok: false, issues: normaliseValibotIssues(parsed.issues) };
  }
  const source = parsed.output;
  const issues: IrIssue[] = [];
  const info: IrIssue[] = [];
  const lookup = (ns: string, name: string): Entity | undefined =>
    ns === source.namespace ? source.entities[name] : undefined;
  const isPresent = (ns: string): boolean => ns === source.namespace;
  checkSource(source.namespace, source, lookup, isPresent, issues, info);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return info.length > 0
    ? { ok: true, value: source, info }
    : { ok: true, value: source };
}

export function validateIR(value: unknown): IrValidation<IR> {
  const parsed = v.safeParse(IrSchema, value);
  if (!parsed.success) {
    return { ok: false, issues: normaliseValibotIssues(parsed.issues) };
  }
  const ir = parsed.output;
  const issues: IrIssue[] = [];
  const info: IrIssue[] = [];

  if (!isCompatible(ir.irVersion)) {
    pushIssue(
      issues,
      'irVersion',
      'version_incompatible',
      `IR version '${ir.irVersion}' is not compatible with supported version '${IR_VERSION}'`,
    );
  }

  const lookup = (ns: string, name: string): Entity | undefined =>
    ir.sources[ns]?.entities[name];
  const isPresent = (ns: string): boolean => ns in ir.sources;

  for (const [key, source] of Object.entries(ir.sources)) {
    if (source.namespace !== key) {
      pushIssue(
        issues,
        `sources.${key}`,
        'namespace_key_mismatch',
        `source key '${key}' does not match namespace '${source.namespace}'`,
      );
    }
    checkSource(source.namespace, source, lookup, isPresent, issues, info);
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return info.length > 0
    ? { ok: true, value: ir, info }
    : { ok: true, value: ir };
}

export function assertIR(value: unknown): asserts value is IR {
  const result = validateIR(value);
  if (!result.ok) {
    throw new IrValidationError(result.issues);
  }
}

export function assertSourceIR(value: unknown): asserts value is SourceIR {
  const result = validateSourceIR(value);
  if (!result.ok) {
    throw new IrValidationError(result.issues);
  }
}

export function parseIR(json: string): IR {
  const value = JSON.parse(json) as unknown;
  assertIR(value);
  return value;
}
