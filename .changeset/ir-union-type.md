---
"@kurotako/ir": minor
---

IR union type support: `FieldType` gains `ref` and `union` kinds (recursive,
`v.lazy`-wrapped schema, hand-written type), a `TypeAlias` registry
(`SourceIR.typeAliases?`), the builder API (`f.ref`, `f.union` with
`UnionBuilder`, `addTypeAlias`), resolution helpers (`resolveRef`,
`resolveTypeAlias`, `iterTypeAliases`, `flattenUnion`) and an exhaustive
`scalarTsType`. Validation walks field types recursively (`unresolved_ref`,
`unresolved_type_alias`, `type_alias_key_mismatch`), tolerates degenerate
unions and reference cycles through a new non-fatal `info` channel on
`IrValidation` (`degenerate_union`, `union_cycle`).

Bumps `IR_VERSION` from `1` to `2`; `isCompatible` stays strict equality, so a
persisted `irVersion: '1'` dump is rejected with `version_incompatible`.
