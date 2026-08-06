/// Unit tests for repository file tree building helpers.
import { describe, expect, test } from 'vitest';

import {
  buildRepositoryFileTree,
  buildVisibleRepositoryTreeRows,
  countRepositoryTreeFiles,
  findRepositoryTreeNodeByPath,
  type FolderTreeNode,
} from '../app/utils/repo-file-tree-utils';

describe('repository file tree helpers', () => {
  test('builds a directory-first sorted tree from repository contents', () => {
    const tree = buildRepositoryFileTree([
      { name: 'z.txt', path: 'z.txt', type: 'file', size: 10 },
      { name: 'src', path: 'src', type: 'dir', size: 0 },
      { name: 'README.md', path: 'README.md', type: 'file', size: 5 },
    ]);

    expect(tree.map((node) => node.name)).toEqual(['src', 'README.md', 'z.txt']);
    expect(tree[0]).toMatchObject({
      type: 'directory',
      loaded: false,
      size: undefined,
    });
    expect(tree[1]).toMatchObject({
      type: 'file',
      loaded: true,
      size: 5,
    });
  });

  test('treats non-directory GitHub content types as file rows', () => {
    const tree = buildRepositoryFileTree([
      { name: 'vendor', path: 'vendor', type: 'submodule', size: 0 },
      { name: 'linked', path: 'linked', type: 'symlink', size: 4 },
    ]);

    expect(tree).toMatchObject([
      {
        name: 'linked',
        type: 'file',
        loaded: true,
      },
      {
        name: 'vendor',
        type: 'file',
        loaded: true,
      },
    ]);
  });

  test('finds nested nodes by path and counts files recursively', () => {
    const tree: FolderTreeNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        loaded: true,
        expanded: false,
        children: [
          {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file',
            loaded: true,
            expanded: false,
            children: [],
            size: 12,
          },
        ],
      },
    ];

    expect(findRepositoryTreeNodeByPath(tree, 'src/index.ts')?.name).toBe('index.ts');
    expect(findRepositoryTreeNodeByPath(tree, 'missing')).toBeNull();
    expect(countRepositoryTreeFiles(tree[0]!)).toBe(1);
  });

  test('flattens single-directory chains while preserving collapse paths', () => {
    const tree: FolderTreeNode[] = [
      {
        name: 'src',
        path: 'src',
        type: 'directory',
        loaded: true,
        expanded: false,
        children: [
          {
            name: 'components',
            path: 'src/components',
            type: 'directory',
            loaded: true,
            expanded: false,
            children: [
              {
                name: 'App.vue',
                path: 'src/components/App.vue',
                type: 'file',
                loaded: true,
                expanded: false,
                children: [],
                size: 20,
              },
            ],
          },
        ],
      },
    ];

    expect(buildVisibleRepositoryTreeRows(tree, new Set())).toMatchObject([
      {
        depth: 0,
        label: 'src/components',
        collapsePath: 'src/components',
      },
      {
        depth: 1,
        label: 'App.vue',
        collapsePath: 'src/components/App.vue',
      },
    ]);

    expect(buildVisibleRepositoryTreeRows(tree, new Set(['src/components']))).toHaveLength(1);
  });
});
