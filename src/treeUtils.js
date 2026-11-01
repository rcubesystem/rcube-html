// Pure helpers for Tree, shared by the component (tree.js) and the form actions (form.js)
// Nodes: { id, label, children?, hasChildren?, hasMore?, cursor?, type?, icon?, ... } (ids compared as strings)

export const TREE_VIEWS = ['tree', 'explorer', 'columns'];

export const labelOf = (node) => String(node?.label ?? node?.name ?? node?.id ?? '');

// A branch has children (loaded or not): children array, hasChildren, or type "folder"
export const isBranch = (node) => Boolean(node) && (Array.isArray(node.children) || node.hasChildren === true || node.type === 'folder');
// Children not loaded yet (lazy): load them on expand
export const needsLoad = (node) => isBranch(node) && !Array.isArray(node.children) && node.hasChildren !== false;

// { node, parent, index, ancestors: [nodes from the root] } or null
export const findTreeNode = (nodes = [], id, ancestors = []) => {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (String(node.id) === String(id)) return { node, parent: ancestors[ancestors.length - 1] ?? null, index: i, ancestors };
    if (Array.isArray(node.children)) {
      const found = findTreeNode(node.children, id, [...ancestors, node]);
      if (found) return found;
    }
  }
  return null;
};

// Replace one node: fn(node) -> new node
export const mapTreeNode = (nodes = [], id, fn) => nodes.map((node) => {
  if (String(node.id) === String(id)) return fn(node);
  if (Array.isArray(node.children)) {
    const children = mapTreeNode(node.children, id, fn);
    return children === node.children ? node : { ...node, children };
  }
  return node;
});

// Insert under parentId (null = root) at index (default: end)
export const insertTreeNode = (nodes = [], parentId, node, index) => {
  const add = (list) => {
    const at = index ?? list.length;
    return [...list.slice(0, at), node, ...list.slice(at)];
  };
  if (parentId === null || parentId === undefined) return add(nodes);
  return mapTreeNode(nodes, parentId, (parent) => ({ ...parent, children: add(parent.children || []) }));
};

export const removeTreeNode = (nodes = [], id) => nodes
  .filter((node) => String(node.id) !== String(id))
  .map((node) => (Array.isArray(node.children) ? { ...node, children: removeTreeNode(node.children, id) } : node));

// Move a node under parentId (null = root) at index; refuses to move a node into itself
export const moveTreeNode = (nodes = [], id, parentId, index) => {
  const found = findTreeNode(nodes, id);
  if (!found) return nodes;
  if (parentId !== null && parentId !== undefined) {
    if (String(parentId) === String(id)) return nodes;
    const target = findTreeNode(nodes, parentId);
    if (!target || target.ancestors.some((a) => String(a.id) === String(id))) return nodes;
  }
  return insertTreeNode(removeTreeNode(nodes, id), parentId ?? null, found.node, index);
};

// Visit every loaded node: fn(node, depth, parent)
export const walkTree = (nodes = [], fn, depth = 0, parent = null) => nodes.forEach((node) => {
  fn(node, depth, parent);
  if (Array.isArray(node.children)) walkTree(node.children, fn, depth + 1, node);
});

export const ancestorIds = (nodes, id) => (findTreeNode(nodes, id)?.ancestors || []).map((a) => String(a.id));

// Ids of loaded descendants
export const descendantIds = (node) => {
  const ids = [];
  walkTree(node?.children || [], (n) => ids.push(String(n.id)));
  return ids;
};

// Ids of nodes flagged "expanded": true in the data
export const initiallyExpanded = (nodes) => {
  const ids = [];
  walkTree(nodes, (n) => { if (n.expanded) ids.push(String(n.id)); });
  return ids;
};
