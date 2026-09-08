/**
 * Reactive typed-forms surface: control-tree interfaces, `FormGroup` type
 * aliases, and one `@Injectable({ providedIn: 'root' })` factory service per
 * entity (`generator-angular/technical.md` §Reactive factory service).
 *
 * `relations: 'deep'`: Angular's `FormGroup<TControl>` requires every control
 * to be a concrete `AbstractControl` — a control key typed `FormGroup<X> |
 * undefined` fails `FormGroup`'s own generic constraint — so a to-one
 * relation's nested group is built eagerly, by delegating to the target
 * entity's own injected `FormFactory`. A to-many relation's `FormArray`
 * starts empty (no eager nested item), which is what keeps a realistic
 * (many-side-breaks-the-cycle) entity graph from recursing forever; a
 * required one-to-one cycle on both sides would still recurse at runtime —
 * accepted, rare/pathological shape, same spirit as `gen-zod`'s deep-family
 * limitations. `add<Relation><Variant>()` methods let the consumer replace a
 * to-one nested group or push a new to-many item after construction.
 */
import type { GeneratorArtifact, Logger } from '@kurotako/core';
import type { Entity, SourceIR } from '@kurotako/ir';
import {
  controlsTypeName,
  factoryMethod,
  factoryName,
  formTypeName,
  type Variant,
} from '../names.js';
import type { AngularGeneratorOptions } from '../options.js';
import { zodEnum, zodModule, zodRefType, zodSymbol } from '../zod-artifact.js';
import {
  type ControlEntry,
  controlExpr,
  controlsInterface,
  controlType,
  type EnumZero,
  enumZeroFromSource,
  fieldControlEntry,
  initExpr,
  type TypeResolvers,
} from './controls.js';
import type { ImportsRecorder } from './imports.js';
import { deepRelations } from './relations.js';
import {
  type DiscriminatedUnion,
  discriminatedUnion,
  unionType,
} from './unions.js';
import { variantFields } from './variants.js';

/**
 * `ControlEntry` for a discriminated union field: a `FormGroup` holding the
 * discriminator `FormControl` plus one nested `FormGroup<<Variant>FormControls>`
 * per discriminator value.
 */
function discriminatedControlEntry(
  union: DiscriminatedUnion,
  fieldName: string,
  variant: Variant,
  family: '' | 'Deep',
): ControlEntry {
  const lit = union.variants.map((v) => JSON.stringify(v.value)).join(' | ');
  const subs = union.variants
    .map(
      (v) =>
        `${JSON.stringify(v.value)}: FormGroup<${controlsTypeName(v.entity, variant, family)}>`,
    )
    .join('; ');
  return {
    name: fieldName,
    fullType: `FormGroup<{ ${JSON.stringify(union.discriminator)}: FormControl<${lit}>; ${subs} }>`,
  };
}

/**
 * The IIFE that builds a discriminated union field's `FormGroup` in a factory
 * method: eager nested sub-groups via the injected target `FormFactory`, then
 * `switchDiscriminatedGroup` to wire the active-variant toggle + `getRawValue`
 * rewrite.
 */
function discriminatedFactoryExpr(
  union: DiscriminatedUnion,
  fieldName: string,
  variant: Variant,
  deep: boolean,
  zod: GeneratorArtifact,
  namespace: string,
  injectedFactories: Map<string, string>,
): string {
  const lit = union.variants.map((v) => JSON.stringify(v.value)).join(' | ');
  const first = JSON.stringify(union.variants[0]?.value ?? '');
  const method = factoryMethod(variant);
  const subLines = union.variants
    .map((v) => {
      const param =
        injectedFactories.get(v.entity) ?? `${lowerFirst(v.entity)}FormFactory`;
      if (variant === 'Create') {
        return `    ${JSON.stringify(v.value)}: this.${param}.${method}(),`;
      }
      const role = deep ? ('updateDeepType' as const) : ('updateType' as const);
      const dto = zodSymbol(zod, namespace, v.entity, role);
      return `    ${JSON.stringify(v.value)}: this.${param}.${method}(value.${fieldName} as unknown as ${dto}),`;
    })
    .join('\n');
  return `(() => {
  const g = new FormGroup({
    ${JSON.stringify(union.discriminator)}: new FormControl<${lit}>(${first}, { nonNullable: true }),
${subLines}
  });
  switchDiscriminatedGroup(g, ${JSON.stringify(union.discriminator)});
  return g;
})()`;
}

function lowerFirst(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

export function reactiveEntity(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  imports: ImportsRecorder,
  cyclicRefs: ReadonlySet<string>,
  logger?: Logger,
): string {
  const deep = options.relations === 'deep';
  const enumZero = enumZeroFromSource(source, entity);
  imports.value('@angular/core', 'Injectable');
  imports.value('@angular/forms', 'FormControl');
  imports.value('@angular/forms', 'FormGroup');

  const zodEnumTypeName = (ref: string): string => {
    const e = zodEnum(zod, namespace, ref);
    imports.type(e.module, e.typeName);
    return e.typeName;
  };

  const blocks: string[] = [];
  const injectedFactories = new Map<string, string>(); // target entity -> ctor param name
  const warnedUnionFields = new Set<string>(); // warn once per field, not per variant

  for (const variant of ['Create', 'Update'] as Variant[]) {
    const family = deep ? 'Deep' : '';
    const schemaRole = deep
      ? variant === 'Create'
        ? ('createDeepSchema' as const)
        : ('updateDeepSchema' as const)
      : variant === 'Create'
        ? ('createSchema' as const)
        : ('updateSchema' as const);
    const typeRole = deep
      ? variant === 'Create'
        ? ('createDeepType' as const)
        : ('updateDeepType' as const)
      : variant === 'Create'
        ? ('createType' as const)
        : ('updateType' as const);

    const module = zodModule(zod, namespace, entity.name);
    const schemaId = zodSymbol(zod, namespace, entity.name, schemaRole);
    const typeId = zodSymbol(zod, namespace, entity.name, typeRole);
    imports.value(module, schemaId);
    imports.type(module, typeId);
    imports.value(`${namespace}/angular/zod-forms.runtime`, 'zodValidator');

    const interfaceName = controlsTypeName(entity.name, variant, family);
    const formType = formTypeName(entity.name, variant, family);

    const resolvers: TypeResolvers = {
      enumTypeName: zodEnumTypeName,
      refTypeName: (ref) => {
        const r = zodRefType(zod, namespace, ref);
        imports.type(r.module, r.typeName);
        return r.typeName;
      },
      cyclicRefs,
    };

    const fieldEntries: ControlEntry[] = variantFields(entity, variant).map(
      (field) => {
        const union =
          field.type.kind === 'union'
            ? discriminatedUnion(field, source)
            : undefined;
        if (union !== undefined) {
          imports.value(
            `${namespace}/angular/zod-forms.runtime`,
            'switchDiscriminatedGroup',
          );
          for (const v of union.variants) {
            const targetModule = `${namespace}/angular/${v.entity}.form`;
            imports.type(
              targetModule,
              controlsTypeName(v.entity, variant, family),
            );
            if (!injectedFactories.has(v.entity)) {
              injectedFactories.set(
                v.entity,
                `${lowerFirst(v.entity)}FormFactory`,
              );
              imports.value(targetModule, factoryName(v.entity));
            }
            if (variant === 'Update') {
              const role = deep
                ? ('updateDeepType' as const)
                : ('updateType' as const);
              imports.type(
                zodModule(zod, namespace, v.entity),
                zodSymbol(zod, namespace, v.entity, role),
              );
            }
          }
          return discriminatedControlEntry(union, field.name, variant, family);
        }
        if (field.type.kind === 'union' && !warnedUnionFields.has(field.name)) {
          warnedUnionFields.add(field.name);
          const recursive = unionType(
            field.type,
            resolvers.refTypeName,
            resolvers.enumTypeName,
            cyclicRefs,
          ).recursive;
          const cause = recursive
            ? 'a recursive ref branch (chains into a cycle)'
            : 'no discriminator mapping, an alias target, or a list/nullable union';
          logger?.warn(
            `gen-angular: union field '${entity.name}.${field.name}' has no usable discriminated sub-form (${cause}); emitting a free FormControl${recursive ? '<unknown>' : ''} validated by zodValidator`,
          );
        }
        return fieldControlEntry(field, resolvers);
      },
    );

    const relations = deep
      ? deepRelations(entity, variant, namespace, logger)
      : [];
    const manyRelations = relations.filter((r) => r.many);
    if (manyRelations.length > 0) {
      imports.value('@angular/forms', 'FormArray');
    }
    for (const rel of relations) {
      const targetModule = `${namespace}/angular/${rel.relation.target.entity}.form`;
      imports.type(
        targetModule,
        controlsTypeName(rel.relation.target.entity, variant, 'Deep'),
      );
      imports.type(targetModule, rel.targetFormType);
      if (!injectedFactories.has(rel.relation.target.entity)) {
        const paramName = `${lowerFirst(rel.relation.target.entity)}FormFactory`;
        injectedFactories.set(rel.relation.target.entity, paramName);
        imports.value(targetModule, factoryName(rel.relation.target.entity));
      }
      // The `add<Relation><Variant>()` builder (to-many only) takes an
      // `init` / `value` for the *target* entity's own create/update DTO.
      if (rel.many) {
        const targetTypeRole =
          deep && variant === 'Create'
            ? ('createDeepType' as const)
            : deep && variant === 'Update'
              ? ('updateDeepType' as const)
              : variant === 'Create'
                ? ('createType' as const)
                : ('updateType' as const);
        const targetZodModule = zodModule(
          zod,
          namespace,
          rel.relation.target.entity,
        );
        const targetTypeId = zodSymbol(
          zod,
          namespace,
          rel.relation.target.entity,
          targetTypeRole,
        );
        imports.type(targetZodModule, targetTypeId);
      }
    }

    blocks.push(
      controlsInterface(interfaceName, [
        ...fieldEntries,
        ...relations.map((r) => r.entry),
      ]),
    );
    blocks.push(`export type ${formType} = FormGroup<${interfaceName}>;`);
  }

  blocks.push(
    renderFactoryClass(
      entity,
      namespace,
      source,
      options,
      zod,
      injectedFactories,
      enumZero,
      cyclicRefs,
    ),
  );

  return blocks.join('\n\n');
}

function renderFactoryClass(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  injectedFactories: Map<string, string>,
  enumZero: EnumZero,
  cyclicRefs: ReadonlySet<string>,
): string {
  const deep = options.relations === 'deep';
  const className = factoryName(entity.name);

  const ctorParams = [...injectedFactories.entries()]
    .map(
      ([target, param]) => `private readonly ${param}: ${factoryName(target)}`,
    )
    .join(', ');
  const ctor =
    ctorParams.length > 0 ? `\n  constructor(${ctorParams}) {}\n` : '';

  const methods: string[] = [];
  for (const variant of ['Create', 'Update'] as Variant[]) {
    methods.push(
      renderFactoryMethod(
        entity,
        namespace,
        source,
        variant,
        options,
        zod,
        injectedFactories,
        enumZero,
        cyclicRefs,
      ),
    );
  }

  if (deep) {
    for (const variant of ['Create', 'Update'] as Variant[]) {
      // Only the to-many side needs a builder: a to-one nested group is
      // already built eagerly (see the module docstring), and its target
      // factory's Update method requires a value this method has no natural
      // source for.
      const relations = deepRelations(
        entity,
        variant,
        namespace,
        undefined,
      ).filter((r) => r.many);
      for (const rel of relations) {
        methods.push(
          renderBuilderMethod(
            entity,
            namespace,
            variant,
            options,
            zod,
            rel,
            injectedFactories,
          ),
        );
      }
    }
  }

  const body = [
    ctor,
    ...methods.map((m) => `\n  ${m.split('\n').join('\n  ')}\n`),
  ]
    .join('')
    .trimEnd();

  return `@Injectable({ providedIn: 'root' })\nexport class ${className} {\n${body}\n}`;
}

function renderFactoryMethod(
  entity: Entity,
  namespace: string,
  source: SourceIR,
  variant: Variant,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  injectedFactories: Map<string, string>,
  enumZero: EnumZero,
  cyclicRefs: ReadonlySet<string>,
): string {
  const deep = options.relations === 'deep';
  const family = deep ? 'Deep' : '';
  const typeRole =
    deep && variant === 'Create'
      ? ('createDeepType' as const)
      : deep && variant === 'Update'
        ? ('updateDeepType' as const)
        : variant === 'Create'
          ? ('createType' as const)
          : ('updateType' as const);
  const schemaRole =
    deep && variant === 'Create'
      ? ('createDeepSchema' as const)
      : deep && variant === 'Update'
        ? ('updateDeepSchema' as const)
        : variant === 'Create'
          ? ('createSchema' as const)
          : ('updateSchema' as const);

  const typeId = zodSymbol(zod, namespace, entity.name, typeRole);
  const schemaId = zodSymbol(zod, namespace, entity.name, schemaRole);
  const interfaceName = controlsTypeName(entity.name, variant, family);
  const formType = formTypeName(entity.name, variant, family);
  const methodName = factoryMethod(variant);

  const resolvers: TypeResolvers = {
    enumTypeName: (ref) => ref,
    refTypeName: (ref) => zodRefType(zod, namespace, ref).typeName,
    cyclicRefs,
  };
  const fields = variantFields(entity, variant);
  const lines = fields.map((field) => {
    const union =
      field.type.kind === 'union'
        ? discriminatedUnion(field, source)
        : undefined;
    if (union !== undefined) {
      return `    ${field.name}: ${discriminatedFactoryExpr(
        union,
        field.name,
        variant,
        deep,
        zod,
        namespace,
        injectedFactories,
      )},`;
    }
    const typeArg = controlType(field, resolvers);
    // The Update Zod DTO is a whole-object `.partial()` (gen-zod), so every
    // field — including one that is otherwise required — is `T | undefined`
    // there too; both variants therefore need the same `?? <zero>` fallback.
    const accessor =
      variant === 'Create' ? `init?.${field.name}` : `value.${field.name}`;
    const seed = `${accessor} ?? ${initExpr(field, enumZero)}`;
    return `    ${field.name}: ${controlExpr(field, typeArg, seed)},`;
  });

  const relations = deep
    ? deepRelations(entity, variant, namespace, undefined)
    : [];
  const relationLines = relations.map((r) => {
    if (r.many) {
      const targetControls = controlsTypeName(
        r.relation.target.entity,
        variant,
        'Deep',
      );
      return `    ${r.entry.name}: new FormArray<FormGroup<${targetControls}>>([]),`;
    }
    const factoryParam =
      injectedFactories.get(r.relation.target.entity) ??
      `${lowerFirst(r.relation.target.entity)}FormFactory`;
    // The Update DTO's whole-object `.partial()` also makes a required
    // relation optional at the type level (same as scalar fields above);
    // `createUpdateForm` itself still requires a concrete value, so the
    // caller is expected to supply the nested relation on a value it read
    // back — asserted here rather than defaulted (there is no meaningful
    // "empty" nested entity to fall back to).
    const nestedArg =
      variant === 'Create'
        ? `init?.${r.relation.name}`
        : `value.${r.relation.name}!`;
    return `    ${r.entry.name}: this.${factoryParam}.${factoryMethod(variant)}(${nestedArg}),`;
  });

  const groupBody = [...lines, ...relationLines].join('\n');
  const paramList =
    variant === 'Create' ? `init?: Partial<${typeId}>` : `value: ${typeId}`;

  return `${methodName}(${paramList}): ${formType} {\n  return new FormGroup<${interfaceName}>({\n${groupBody}\n  }, { validators: [zodValidator(${schemaId})] });\n}`;
}

/** Only ever called for a to-many relation (see the caller). */
function renderBuilderMethod(
  entity: Entity,
  namespace: string,
  variant: Variant,
  options: AngularGeneratorOptions,
  zod: GeneratorArtifact,
  rel: ReturnType<typeof deepRelations>[number],
  injectedFactories: Map<string, string>,
): string {
  const deep = options.relations === 'deep';
  const target = rel.relation.target.entity;
  const factoryParam =
    injectedFactories.get(target) ?? `${lowerFirst(target)}FormFactory`;
  const formType = formTypeName(entity.name, variant, 'Deep');
  const targetFormType = rel.targetFormType;
  const method = rel.builderMethod;

  const targetTypeRole =
    deep && variant === 'Create'
      ? ('createDeepType' as const)
      : deep && variant === 'Update'
        ? ('updateDeepType' as const)
        : variant === 'Create'
          ? ('createType' as const)
          : ('updateType' as const);
  const targetTypeId = zodSymbol(zod, namespace, target, targetTypeRole);

  const param =
    variant === 'Create'
      ? `init?: Partial<${targetTypeId}>`
      : `value: ${targetTypeId}`;
  const createCall = `this.${factoryParam}.${factoryMethod(variant)}(${variant === 'Create' ? 'init' : 'value'})`;

  return `${method}(form: ${formType}, ${param}): ${targetFormType} {\n  const group = ${createCall};\n  form.controls.${rel.relation.name}.push(group);\n  return group;\n}`;
}
