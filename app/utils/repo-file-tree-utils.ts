/** A node in the repository file tree (file or directory). */
export interface FolderTreeNode {
  name: string;
  path: string;
  type: 'directory' | 'file';
  children: FolderTreeNode[];
  loaded: boolean;
  expanded: boolean;
  size?: number;
}

/** A flattened row ready for rendering in the file-tree UI. */
export interface VisibleTreeRow {
  node: FolderTreeNode;
  depth: number;
  label: string;
  collapsePath: string;
}

/** Raw file metadata from the repository API. */
export interface RepositoryFileTreeItem {
  name: string;
  path: string;
  type: string;
  size: number;
}

/** Converts flat file metadata into a sorted tree of FolderTreeNodes. */
export const buildRepositoryFileTree = (items: RepositoryFileTreeItem[]): FolderTreeNode[] => {
  const nodes = items.map((item) => {
    const isDirectory = item.type === 'dir';

    return {
      name: item.name,
      path: item.path,
      type: isDirectory ? ('directory' as const) : ('file' as const),
      children: [],
      loaded: !isDirectory,
      expanded: false,
      size: isDirectory ? undefined : item.size,
    };
  });

  return sortRepositoryFileTree(nodes);
};

/** Sorts tree nodes with directories first, then alphabetically by name. */
export const sortRepositoryFileTree = (nodes: FolderTreeNode[]) => {
  return [...nodes].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
};

/** Recursively searches the tree for a node matching the given path. */
export const findRepositoryTreeNodeByPath = (
  nodes: FolderTreeNode[],
  path: string
): FolderTreeNode | null => {
  for (const node of nodes) {
    if (node.path === path) return node;

    const found = findRepositoryTreeNodeByPath(node.children, path);
    if (found) return found;
  }

  return null;
};

/** Recursively counts all file nodes under the given tree node. */
export const countRepositoryTreeFiles = (node: FolderTreeNode): number => {
  if (node.type === 'file') return 1;

  return node.children.reduce((total, child) => total + countRepositoryTreeFiles(child), 0);
};

/**
 * Flattens the tree into visible rows, collapsing single-child directory
 * chains and respecting collapsed state.
 */
export const buildVisibleRepositoryTreeRows = (
  nodes: FolderTreeNode[],
  collapsedPaths: ReadonlySet<string>
) => {
  const rows: VisibleTreeRow[] = [];

  const visit = (currentNodes: FolderTreeNode[], depth: number) => {
    for (const node of currentNodes) {
      let visibleNode = node;
      const labelParts = [node.name];

      while (
        visibleNode.type === 'directory' &&
        visibleNode.children.length === 1 && // collapse single-child directory chains into one row
        visibleNode.children[0]?.type === 'directory' // only merge directory-into-directory, not files
      ) {
        visibleNode = visibleNode.children[0];
        labelParts.push(visibleNode.name);
      }

      const collapsePath = visibleNode.path;
      rows.push({ node: visibleNode, depth, label: labelParts.join('/'), collapsePath });

      if (visibleNode.type === 'directory' && !collapsedPaths.has(collapsePath)) {
        visit(visibleNode.children, depth + 1);
      }
    }
  };

  visit(nodes, 0);
  return rows;
};
