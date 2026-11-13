// Schema shorthands, made regular once when a form gets its schema (useDynamicTag / DynamicTag):
//
//   A single child can be written as an object:
//     { type: "column", children: { type: "InputField", props: { name: "email" } } }
//   is read as children: [ { … } ]. The same for items[].children (Tabs, Accordion, Carousel) and footer (Modal).
//   Empty entries (null / false / undefined) are left out, so `cond && node` works inside a list.
//
//   The id is optional. A node without one gets:
//     - a field (or any node with props.name): its name, e.g. "email" (then "email-2", … when taken)
//     - any other node: its parent's id + its type + its place among its siblings, e.g. "row1", "row1-column2",
//       "row1-column2-p1", "card1-h3-1"
//   Ids written in the schema are kept and never reused for another node. Give a node an id yourself when code
//   changes it (setNodeProps, hideNode, …) and the schema around it may change: a generated id follows the node's place.
//
// childrenOf(node) / asList(value) read children the same way in your own code (e.g. a function that walks a schema).

/** A list from a list, a single value or nothing: asList(x) -> [x]; empty entries are left out */
export const asList = (value) => (value == null || value === false ? [] : (Array.isArray(value) ? value : [value])).filter((x) => x != null && x !== false);

/** A node's children as a list (a single child written as an object counts as one) */
export const childrenOf = (node) => asList(node?.children);

const SLUG = /[^a-z0-9_-]+/g;
const slug = (text) => String(text).toLowerCase().replace(SLUG, '-').replace(/^-+|-+$/g, '');
const typeOf = (node) => slug((node.type === 'component' ? node.componentName : node.type) || 'node') || 'node';

/** Every id written in a schema (deep), to keep generated ids clear of them */
export const schemaIds = (nodes, into = new Set()) => {
  for (const node of asList(nodes)) {
    if (!node || typeof node !== 'object') continue;
    if (node.id != null && node.id !== '') into.add(String(node.id));
    schemaIds(node.children, into);
    asList(node.items).forEach((item) => item && typeof item === 'object' && schemaIds(item.children, into));
    schemaIds(node.footer, into);
  }
  return into;
};

/**
 * The schema with lists everywhere a single child may be written as an object, and an id on every node.
 *   normalizeSchema(schema)                                  -> a new schema (the one given is not changed)
 *   normalizeSchema(more, { taken: ids, prefix: "toolbar-" }) -> clear of the ids in `taken` (a Set; filled in)
 * Already-regular schemas come back with the same shape (ids written by hand are kept as they are).
 */
export const normalizeSchema = (nodes, { taken, prefix = '' } = {}) => {
  const used = taken || new Set();
  schemaIds(nodes, used);
  const unique = (base) => {
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    return id;
  };
  const list = (value, parentId) => {
    const counts = {};
    return asList(value).map((node) => {
      if (!node || typeof node !== 'object') return node;
      const type = typeOf(node);
      counts[type] = (counts[type] || 0) + 1;
      let id = node.id;
      if (id == null || id === '') {
        const name = node.props?.name ? slug(node.props.name) : '';
        id = unique(name || (parentId ? `${parentId}-${type}${counts[type]}` : `${prefix}${type}${counts[type]}`));
      }
      const next = { ...node, id };
      if (node.children !== undefined) next.children = list(node.children, id);
      if (node.items !== undefined && Array.isArray(node.items)) {
        next.items = node.items.map((item, i) => (item && typeof item === 'object' && item.children !== undefined
          ? { ...item, children: list(item.children, `${id}-${slug(item.key ?? i + 1)}`) } : item));
      }
      if (node.footer !== undefined) next.footer = list(node.footer, `${id}-footer`);
      return next;
    });
  };
  return list(nodes, '');
};
