import { describe, expect, it } from 'vitest';
import { OutputPeerConflictError } from '../errors.js';
import type { VirtualFile } from '../types.js';
import { collectPeerDependencies } from './peers.js';

function file(path: string): VirtualFile {
  return { path, content: '' };
}

const files: VirtualFile[] = [
  file('pg/zod/user.schema.ts'),
  file('pg/angular/user.form.ts'),
];

describe('collectPeerDependencies', () => {
  it('unions disjoint peer sets per namespace with sorted keys', () => {
    const result = collectPeerDependencies(
      {
        zod: { entities: {}, peerDependencies: { zod: '^4' } },
        angular: {
          entities: {},
          peerDependencies: {
            '@angular/forms': '>=17',
            '@angular/core': '>=17',
          },
        },
      },
      files,
    );
    expect(result.pg).toEqual({
      '@angular/core': '>=17',
      '@angular/forms': '>=17',
      zod: '^4',
    });
    expect(Object.keys(result.pg ?? {})).toEqual([
      '@angular/core',
      '@angular/forms',
      'zod',
    ]);
  });

  it('de-duplicates an identical range declared by both generators', () => {
    const result = collectPeerDependencies(
      {
        zod: { entities: {}, peerDependencies: { typescript: '^5' } },
        angular: { entities: {}, peerDependencies: { typescript: '^5' } },
      },
      files,
    );
    expect(result.pg).toEqual({ typescript: '^5' });
  });

  it('throws OutputPeerConflictError naming both generators on a range conflict', () => {
    expect(() =>
      collectPeerDependencies(
        {
          zod: { entities: {}, peerDependencies: { zod: '^3' } },
          angular: { entities: {}, peerDependencies: { zod: '^4' } },
        },
        files,
      ),
    ).toThrowError(OutputPeerConflictError);
    try {
      collectPeerDependencies(
        {
          zod: { entities: {}, peerDependencies: { zod: '^3' } },
          angular: { entities: {}, peerDependencies: { zod: '^4' } },
        },
        files,
      );
    } catch (error) {
      const conflict = error as OutputPeerConflictError;
      expect([...conflict.generators].sort()).toEqual(['angular', 'zod']);
      expect([...conflict.ranges].sort()).toEqual(['^3', '^4']);
      expect(conflict.package).toBe('zod');
    }
  });

  it('yields an empty record for a namespace whose generators declare no peers', () => {
    const result = collectPeerDependencies(
      { zod: { entities: {} }, angular: { entities: {} } },
      files,
    );
    expect(result.pg).toEqual({});
  });
});
