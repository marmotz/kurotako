/**
 * Import-block accumulator shared by `render/reactive.ts`, `render/signal.ts`
 * and `emit/entity.ts`. Collects the module specifiers + identifiers a rendered
 * entity file needs while it is being assembled, so the final `import` block can
 * be built once, sorted, and split into value vs. type-only lines
 * (`generator-angular/technical.md` §Determinism: import lines sorted by module
 * specifier, named imports sorted).
 */

export class ImportsRecorder {
  private readonly values = new Map<string, Set<string>>();
  private readonly types = new Map<string, Set<string>>();

  value(module: string, name: string): void {
    add(this.values, module, name);
  }

  type(module: string, name: string): void {
    add(this.types, module, name);
  }

  /** The full `import ...` block text, one statement per line, no trailing blank line. */
  render(): string {
    const lines: { spec: string; rank: 0 | 1; stmt: string }[] = [];
    for (const [spec, names] of this.values) {
      lines.push({ spec, rank: 0, stmt: importStmt(spec, [...names], false) });
    }
    for (const [spec, names] of this.types) {
      lines.push({ spec, rank: 1, stmt: importStmt(spec, [...names], true) });
    }
    lines.sort((a, b) => a.spec.localeCompare(b.spec) || a.rank - b.rank);
    return lines.map((l) => l.stmt).join('\n');
  }
}

function add(
  map: Map<string, Set<string>>,
  module: string,
  name: string,
): void {
  const set = map.get(module) ?? new Set<string>();
  set.add(name);
  map.set(module, set);
}

function importStmt(spec: string, names: string[], typeOnly: boolean): string {
  const sorted = [...names].sort((a, b) => a.localeCompare(b)).join(', ');
  const kw = typeOnly ? 'import type' : 'import';
  return `${kw} { ${sorted} } from '${spec}';`;
}
