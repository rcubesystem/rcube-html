import { registerComponent } from "./html";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonGroup, Form, Spinner } from "./ui";
import { useTranslator } from "./i18n";
import { runAction } from "./form";
import { toolbarButtons } from "./toolbar";
import { matchesRule } from "./tableUtils";
import { fileKindColor, formatBytes } from "./uploadUtils";
import {
  TREE_VIEWS, descendantIds, findTreeNode, initiallyExpanded, isBranch, labelOf, mapTreeNode, moveTreeNode, needsLoad, walkTree,
} from "./treeUtils";

/*
 * Tree — schema-driven tree with three views: "tree", "explorer" (folders + contents, like a file explorer)
 * and "columns" (one column per level).
 *
 * { "type": "Tree", "id": "files", "props": {
 *     "view": "tree", "views": ["tree", "explorer", "columns"], "height": 420,
 *     "nodes": [ { "id": "docs", "label": "Documents", "children": [ { "id": "a", "label": "a.pdf", "size": 1200 } ] },
 *                { "id": "logs", "label": "logs", "hasChildren": true } ],        // children loaded on expand
 *     "onLoadChildren": "loadChildren()",   // (payload { node, parentId, cursor, offset, pageSize, more }) -> { children, hasMore, cursor }
 *     "selectionMode": "single", "checkboxes": false, "cascadeCheck": true, "showLines": true,
 *     "searchable": true, "searchMode": "client", "filters": [ { "id": "pdf", "label": "PDF", "when": { "field": "ext", "equals": "pdf" } } ],
 *     "toolbar": true, "toolbarActions": [ { "text": "New folder", "onClick": "newFolder()", "needsSelection": true } ],
 *                                           // your buttons -> (event, { tree, selected, checked, nodes })
 *     "pageSize": 50, "loadMore": "scroll", "draggable": true, "editable": true,
 *     "contextMenu": [ { "text": "Rename", "command": "rename" }, { "text": "Delete", "onClick": "deleteNode()" } ],
 *                    // like table buttons: "text" and "onClick" ("label" / "action" still work); "when" shows it for some nodes
 *     "onExpand": "...", "onCollapse": "...", "onSelect": "...", "onActivate": "...", "onNodeFocus": "...", "onCheck": "...",
 *     "onSearch": "...", "onFilterChange": "...", "onMove": "...", "onRename": "...", "onDelete": "...", "onNavigate": "...",
 *     "onScrollEnd": "...", "onNodeClick": "...", "onNodeDoubleClick": "...", "onContextMenu": "..." } }
 *
 * nodes / expanded / selected / checked / search / activeFilters / folder / view changed at runtime live in the form's element
 * state (actions.setTreeNodes, addTreeNode, expandTreeNode, selectTreeNode, openTreeFolder, setTreeSearch, ...).
 */

const TREE_CSS = `
.rcube-tree{position:relative;font-size:.875rem}
.rcube-tree .rt-pane{border:1px solid var(--rc-border-color);border-radius:8px;background:var(--rc-body-bg);overflow:hidden;display:flex;flex-direction:column;min-width:0}
.rcube-tree .rt-scroll{overflow-y:auto;position:relative;outline:none;flex:1 1 auto}
.rcube-tree .rt-scroll:focus-visible{box-shadow:inset 0 0 0 2px rgba(var(--rc-primary-rgb),.5)}
.rcube-tree .rt-row{position:absolute;left:0;right:0;display:flex;align-items:center;gap:4px;padding-right:8px;cursor:default;user-select:none;white-space:nowrap}
.rcube-tree .rt-row:hover{background:var(--rc-tertiary-bg)}
.rcube-tree .rt-row.rt-sel{background:rgba(var(--rc-primary-rgb),.14)}
.rcube-tree .rt-row.rt-focus{box-shadow:inset 0 0 0 1px rgba(var(--rc-primary-rgb),.6)}
.rcube-tree .rt-row.rt-disabled{opacity:.5}
.rcube-tree .rt-row.rt-drop-inside{background:rgba(var(--rc-primary-rgb),.22)}
.rcube-tree .rt-row.rt-drop-before{box-shadow:inset 0 2px 0 var(--rc-primary)}
.rcube-tree .rt-row.rt-drop-after{box-shadow:inset 0 -2px 0 var(--rc-primary)}
.rcube-tree .rt-twisty{width:20px;height:20px;flex:none;display:flex;align-items:center;justify-content:center;border:0;background:none;padding:0;color:var(--rc-secondary-color);border-radius:4px}
.rcube-tree .rt-twisty:hover{background:var(--rc-secondary-bg)}
.rcube-tree .rt-twisty svg{transition:transform .15s ease}
.rcube-tree .rt-open>svg{transform:rotate(90deg)}
.rcube-tree .rt-guide{position:absolute;top:0;bottom:0;border-left:1px solid var(--rc-border-color);pointer-events:none}
.rcube-tree .rt-icon{width:18px;height:18px;flex:none;display:inline-flex;align-items:center;justify-content:center}
.rcube-tree .rt-label{overflow:hidden;text-overflow:ellipsis;min-width:0}
.rcube-tree .rt-sub{color:var(--rc-secondary-color);font-size:.75rem;overflow:hidden;text-overflow:ellipsis}
.rcube-tree .rt-badge{margin-left:auto;font-size:.6875rem;color:var(--rc-secondary-color);background:var(--rc-secondary-bg);border-radius:999px;padding:0 6px;flex:none}
.rcube-tree .rt-note{color:var(--rc-secondary-color);font-size:.8125rem;display:flex;align-items:center;gap:6px}
.rcube-tree mark.rt-mark{padding:0;background:rgba(237,161,0,.35);color:inherit;border-radius:2px}
.rcube-tree .rt-chip{border:1px solid var(--rc-border-color);background:var(--rc-body-bg);border-radius:999px;padding:1px 10px;font-size:.8125rem;color:var(--rc-body-color)}
.rcube-tree .rt-chip[aria-pressed=true]{background:rgba(var(--rc-primary-rgb),.14);border-color:var(--rc-primary);color:var(--rc-primary)}
.rcube-tree .rt-head{display:grid;align-items:center;font-size:.75rem;font-weight:600;color:var(--rc-secondary-color);border-bottom:1px solid var(--rc-border-color);background:var(--rc-tertiary-bg)}
.rcube-tree .rt-head button{border:0;background:none;text-align:left;padding:6px 8px;color:inherit;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rcube-tree .rt-grid-row{display:grid;align-items:center}
.rcube-tree .rt-grid-row>div{padding:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcube-tree .rt-crumbs{display:flex;align-items:center;gap:2px;min-width:0;overflow:hidden}
.rcube-tree .rt-crumbs button{border:0;background:none;padding:2px 6px;border-radius:4px;color:var(--rc-body-color);white-space:nowrap;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.rcube-tree .rt-crumbs button:hover{background:var(--rc-secondary-bg)}
.rcube-tree .rt-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px;padding:8px}
.rcube-tree .rt-tile{border:1px solid transparent;border-radius:8px;padding:10px 6px;text-align:center;cursor:default;user-select:none}
.rcube-tree .rt-tile:hover{background:var(--rc-tertiary-bg)}
.rcube-tree .rt-tile.rt-sel{background:rgba(var(--rc-primary-rgb),.14);border-color:rgba(var(--rc-primary-rgb),.4)}
.rcube-tree .rt-tile.rt-focus{border-color:var(--rc-primary)}
.rcube-tree .rt-tile .rt-label{display:block;font-size:.8125rem;margin-top:6px;word-break:break-word;white-space:normal;max-height:2.6em}
.rcube-tree .rt-columns{display:flex;overflow-x:auto}
.rcube-tree .rt-col{width:240px;flex:none;border-right:1px solid var(--rc-border-color);overflow-y:auto}
.rcube-tree .rt-col .rt-row{position:relative}
.rcube-tree .rt-menu{position:absolute;z-index:30;min-width:180px;background:var(--rc-body-bg);border:1px solid var(--rc-border-color);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:4px}
.rcube-tree .rt-menu button{display:flex;gap:8px;width:100%;border:0;background:none;text-align:left;padding:6px 10px;border-radius:4px;color:var(--rc-body-color)}
.rcube-tree .rt-menu button:hover,.rcube-tree .rt-menu button:focus{background:var(--rc-secondary-bg);outline:none}
.rcube-tree .rt-menu hr{margin:4px 0}
.rcube-tree .rt-rename{height:22px;font-size:.875rem;padding:0 4px;min-width:120px}
`;

const ROOT = '__root__';
const DEFAULT_COLUMNS = [
  { key: 'label', title: '@tree.name' },
  { key: 'size', title: '@tree.size', format: 'bytes', width: '100px', align: 'end' },
  { key: 'modified', title: '@tree.modified', format: 'datetime', width: '170px' },
  { key: 'kind', title: '@tree.kind', width: '120px' },
];

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const FolderIcon = ({ open, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    {open
      ? <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.2l2 2h8.8A1.5 1.5 0 0 1 21 9.5V10H7.2a2 2 0 0 0-1.9 1.4L3 18.5z M5.3 11.4A1.5 1.5 0 0 1 6.7 10.4h15a1 1 0 0 1 .95 1.3l-2.3 6.9a1.5 1.5 0 0 1-1.4 1H4a1 1 0 0 1-.95-1.3z" fill="#e8a317" />
      : <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2h8.4A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z" fill="#f0b429" />}
  </svg>
);
const FileIcon = ({ color, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="var(--rc-body-bg)" stroke="var(--rc-secondary-color)" strokeWidth="1.3" />
    <path d="M14 3v5h5" fill="none" stroke="var(--rc-secondary-color)" strokeWidth="1.3" />
    <rect x="7.5" y="13" width="9" height="4.5" rx="1" fill={color} />
  </svg>
);

const extOf = (node) => (/\.([a-z0-9]{1,6})$/i.exec(labelOf(node))?.[1] || '').toLowerCase();

// Windowed list: only rows near the viewport are rendered
const VirtualRows = ({ count, rowHeight, height, renderRow, onVisible, onBottom, scrollRef, className, ...rest }) => {
  const [scrollTop, setScrollTop] = useState(0);
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - 10);
  const end = Math.min(count, Math.ceil((scrollTop + height) / rowHeight) + 10);
  useEffect(() => { onVisible?.(start, end); });
  const indexes = [];
  for (let i = start; i < end; i += 1) indexes.push(i);
  return (
    <div ref={scrollRef} className={`rt-scroll ${className || ''}`} style={{ height }} {...rest}
      onScroll={(e) => {
        const el = e.currentTarget;
        setScrollTop(el.scrollTop);
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - rowHeight) onBottom?.();
      }}>
      <div style={{ height: count * rowHeight, position: 'relative' }}>
        {indexes.map((i) => renderRow(i, { top: i * rowHeight, height: rowHeight }))}
      </div>
    </div>
  );
};

export const Tree = ({
  nodeId, actions,
  nodes: nodesProp = [], view: viewProp = 'tree', views = ['tree'],
  height = 420, rowHeight = 30, indent = 18,
  selectionMode = 'single', checkboxes = false, cascadeCheck = true,
  expanded: expandedProp, selected: selectedProp = [], checked: checkedProp = [], defaultExpandAll = false,
  showIcons = true, showLines = false, showCount = false,
  searchable = true, searchMode = 'client', search: searchProp = '', searchPlaceholder,
  filters = [], filterMode = 'any', remoteFilter = false, activeFilters: activeFiltersProp = [], filterKeepsBranches = true,
  pageSize = 50, loadMore = 'scroll', lazyRoot = false, rootHasMore: rootHasMoreProp = false, rootCursor: rootCursorProp,
  draggable = false, editable = false, contextMenu = [],
  columns = DEFAULT_COLUMNS, contentView: contentViewProp = 'details', contentPaging = 'scroll', folder: folderProp = null,
  columnsPath: columnsPathProp = [], rootLabel,
  toolbar = true, toolbarActions, title, emptyText, locale, autoUpdate = true, scrollRequest,
  className = '', style,
  onExpand, onCollapse, onSelect, onActivate, onNodeClick, onNodeDoubleClick, onNodeFocus, onCheck,
  onLoadChildren, onLoadMore, onSearch, onFilterChange, onMove, onRename, onDelete, onNavigate, onScrollEnd, onContextMenu,
}) => {
  const t = useTranslator();
  const rootRef = useRef(null);
  const treeScrollRef = useRef(null);
  const contentScrollRef = useRef(null);
  const domId = `rt-${String(nodeId || 'tree').replace(/[^\w-]/g, '')}`;

  // ---------------------------------------------------------------- state (form element state when in a form, else local)
  const inForm = Boolean(actions?.setNodeProps && nodeId);
  const [own, setOwn] = useState({});
  const cur = (key, value) => (!inForm && key in own ? own[key] : value);
  const setProps = (patch) => (inForm ? actions.setNodeProps(nodeId, patch) : setOwn((prev) => ({ ...prev, ...patch })));

  const nodes = cur('nodes', nodesProp) || [];
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const writeNodes = (next, extra = {}) => { nodesRef.current = next; setProps({ nodes: next, ...extra }); };

  const allBranchIds = () => { const ids = []; walkTree(nodes, (n) => { if (isBranch(n)) ids.push(String(n.id)); }); return ids; };
  const expandedIds = (cur('expanded', expandedProp ?? (defaultExpandAll ? allBranchIds() : initiallyExpanded(nodesProp))) || []).map(String);
  const expandedSet = new Set(expandedIds);
  const selectedIds = (cur('selected', selectedProp) || []).map(String);
  const selectedSet = new Set(selectedIds);
  const checkedIds = (cur('checked', checkedProp) || []).map(String);
  const checkedSet = new Set(checkedIds);
  const search = cur('search', searchProp) || '';
  const activeFilters = (cur('activeFilters', activeFiltersProp) || []).map(String);
  const view = TREE_VIEWS.includes(cur('view', viewProp)) ? cur('view', viewProp) : 'tree';
  const contentView = cur('contentView', contentViewProp);
  const folder = cur('folder', folderProp);
  const columnsPath = (cur('columnsPath', columnsPathProp) || []).map(String);
  const rootHasMore = cur('rootHasMore', rootHasMoreProp);
  const rootCursorRef = useRef(rootCursorProp);
  rootCursorRef.current = cur('rootCursor', rootCursorProp);

  const [focusId, setFocusId] = useState(null);
  const [contentFocus, setContentFocus] = useState(null);
  const [loadState, setLoadState] = useState({}); // id -> 'loading' | 'error:<message>'
  const loading = useRef(new Set());
  const rootRequested = useRef(false);
  const [menu, setMenu] = useState(null); // { x, y, node }
  const [renaming, setRenaming] = useState(null); // { id, value }
  const dragId = useRef(null);
  const [drop, setDrop] = useState(null); // { id, position }
  const [results, setResults] = useState(null); // server search { query, nodes, hasMore, cursor, loading, error }
  const [sort, setSort] = useState({ key: 'label', dir: 'asc' });
  const [page, setPage] = useState(1);
  const anchorId = useRef(null);
  const typeAhead = useRef({ text: '', at: 0 });
  const pendingScroll = useRef(null);
  const nextPage = useRef(null);
  useEffect(() => {
    const loadNext = nextPage.current;
    nextPage.current = null;
    loadNext?.();
  });

  const q = search.trim().toLowerCase();
  const serverSearch = searchMode === 'server' && q && onSearch;
  const clientSearch = searchMode !== 'server' && q;

  // ---------------------------------------------------------------- formatting / payloads
  const fmtDate = useMemo(() => ({
    date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }),
    datetime: new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }),
  }), [locale]);
  const kindOf = (node) => node.kind || (isBranch(node) ? t('tree.folder') : (extOf(node) ? t('tree.fileOfType', { ext: extOf(node).toUpperCase() }) : t('tree.file')));
  const cellText = (node, column) => {
    const value = column.key === 'label' ? labelOf(node) : column.key === 'kind' ? kindOf(node) : node[column.key];
    if (value === undefined || value === null || value === '') return isBranch(node) && column.format === 'bytes' ? '—' : '';
    if (column.format === 'bytes') return formatBytes(value, locale);
    if (column.format === 'date' || column.format === 'datetime') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? String(value) : fmtDate[column.format].format(d);
    }
    return String(value);
  };
  const columnTitle = (c) => (typeof c.title === 'string' && c.title.startsWith('@') ? t(c.title.slice(1)) : (c.title ?? c.key));

  const nodeById = (id) => (id == null ? null : findTreeNode(nodesRef.current, id)?.node || results?.nodes?.find((n) => String(n.id) === String(id)) || null);
  const payloadFor = (node, extra = {}) => {
    const found = node ? findTreeNode(nodesRef.current, node.id) : null;
    return { tree: nodeId, node, id: node ? String(node.id) : null, path: (found?.ancestors || []).map((a) => String(a.id)), level: found ? found.ancestors.length + 1 : 1, ...extra };
  };

  // ---------------------------------------------------------------- loading (lazy children, more pages)
  const load = async (node, more = false) => {
    const key = node ? String(node.id) : ROOT;
    const handler = (more && onLoadMore) || onLoadChildren;
    if (!handler || loading.current.has(key)) return;
    loading.current.add(key);
    setLoadState((s) => ({ ...s, [key]: 'loading' }));
    const current = node ? findTreeNode(nodesRef.current, node.id)?.node : null;
    const existing = node ? (current?.children || []) : nodesRef.current;
    try {
      const result = await handler({
        tree: nodeId, node: current, parentId: node ? String(node.id) : null, more,
        cursor: more ? (node ? current?.cursor : rootCursorRef.current) : undefined,
        offset: more ? existing.length : 0, pageSize, filters: activeFilters,
      });
      const { children = [], hasMore = false, cursor } = Array.isArray(result) ? { children: result } : (result || {});
      if (node) {
        const latest = findTreeNode(nodesRef.current, node.id)?.node;
        const base = more ? (latest?.children || []) : [];
        writeNodes(mapTreeNode(nodesRef.current, node.id, (n) => ({ ...n, children: [...base, ...children], hasMore: Boolean(hasMore), cursor, hasChildren: true })));
        // A checked folder checks the children it loads
        if (cascadeCheck && checkedSet.has(key)) setProps({ checked: [...new Set([...checkedIds, ...children.map((c) => String(c.id))])] });
      } else {
        writeNodes(more ? [...nodesRef.current, ...children] : children, { rootHasMore: Boolean(hasMore), rootCursor: cursor });
      }
      setLoadState((s) => { const { [key]: _done, ...rest } = s; return rest; });
    } catch (err) {
      setLoadState((s) => ({ ...s, [key]: `error:${err?.message || t('tree.loadFailed')}` }));
    } finally {
      loading.current.delete(key);
    }
  };
  const retry = (node) => {
    const key = node ? String(node.id) : ROOT;
    setLoadState((s) => { const { [key]: _gone, ...rest } = s; return rest; });
    if (node && needsLoad(node)) load(node);
    else load(node, true);
  };
  // Drop a node's loaded children and load them again
  const reload = (node) => {
    if (!node) {
      rootRequested.current = false;
      writeNodes([], { rootHasMore: false, rootCursor: undefined });
      if (lazyRoot) load(null);
      return;
    }
    setLoadState((s) => { const { [String(node.id)]: _gone, ...rest } = s; return rest; });
    writeNodes(mapTreeNode(nodesRef.current, node.id, (n) => ({ ...n, children: undefined, hasChildren: true, hasMore: false, cursor: undefined })));
  };

  // Load what is open but not loaded yet: lazy root, expanded folders, the explorer folder, the columns path
  useEffect(() => {
    if (nodes.length) rootRequested.current = false; // emptied later (reloadTreeNode) -> load again
    else if (lazyRoot && !rootRequested.current && !loadState[ROOT]) { rootRequested.current = true; load(null); }
    const wanted = new Set([...expandedIds, ...(view === 'explorer' && folder != null ? [String(folder)] : []), ...(view === 'columns' ? columnsPath : [])]);
    wanted.forEach((id) => {
      const node = findTreeNode(nodes, id)?.node;
      if (node && needsLoad(node) && !loadState[id]) load(node);
    });
  });

  // Server search (debounced): onSearch({ query, cursor, pageSize, filters }) -> { nodes, hasMore, cursor }
  const runSearch = async (query, more = false) => {
    setResults((r) => ({ ...(more ? r : { nodes: [] }), query, loading: true, error: null }));
    try {
      const result = await onSearch({ tree: nodeId, query, cursor: more ? results?.cursor : undefined, pageSize, filters: activeFilters, folder });
      const { nodes: found = [], hasMore = false, cursor } = Array.isArray(result) ? { nodes: result } : (result || {});
      setResults((r) => (r?.query !== query ? r : { query, nodes: more ? [...(r.nodes || []), ...found] : found, hasMore, cursor, loading: false }));
    } catch (err) {
      setResults((r) => ({ ...r, loading: false, error: err?.message || t('tree.loadFailed') }));
    }
  };
  useEffect(() => {
    if (!serverSearch) { setResults(null); return undefined; }
    const timer = setTimeout(() => runSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search, serverSearch, activeFilters.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- filters / search (client side)
  const filterDefs = filters.filter((f) => activeFilters.includes(String(f.id)));
  const passesFilter = (node) => {
    if (remoteFilter || !filterDefs.length) return true;
    if (filterKeepsBranches && isBranch(node)) return true;
    const test = (f) => matchesRule(f.when, { ...node, label: labelOf(node), ext: node.ext ?? extOf(node) }, 'label');
    return filterMode === 'all' ? filterDefs.every(test) : filterDefs.some(test);
  };
  const subtreeMatch = useMemo(() => new Map(), [nodes, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchesSearch = (node) => {
    if (!clientSearch) return true;
    const key = String(node.id);
    if (subtreeMatch.has(key)) return subtreeMatch.get(key);
    const result = labelOf(node).toLowerCase().includes(q) || (node.children || []).some((c) => matchesSearch(c) && passesFilter(c));
    subtreeMatch.set(key, result);
    return result;
  };
  const highlight = (text) => {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q);
    if (i < 0) return text;
    return <>{text.slice(0, i)}<mark className="rt-mark">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
  };

  // ---------------------------------------------------------------- flattening (rows of the tree pane)
  const flatten = ({ branchesOnly = false, searching = clientSearch } = {}) => {
    const rows = [];
    const statusRows = (key, depth, node) => {
      const st = loadState[key];
      if (st === 'loading') rows.push({ kind: 'loading', depth, node });
      else if (st?.startsWith('error:')) rows.push({ kind: 'error', depth, node, message: st.slice(6) });
    };
    const walk = (list, depth, parentId, guides) => {
      const items = list.filter((n) => (!branchesOnly || isBranch(n)) && passesFilter(n) && (!searching || matchesSearch(n)));
      items.forEach((n, i) => {
        const id = String(n.id);
        const branch = isBranch(n);
        const open = branch && (expandedSet.has(id) || Boolean(searching && (n.children || []).some((c) => matchesSearch(c))));
        rows.push({ kind: 'node', node: n, depth, parentId, posinset: i + 1, setsize: items.length, guides, open });
        if (!open) return;
        if (Array.isArray(n.children)) {
          walk(n.children, depth + 1, id, [...guides, i < items.length - 1]);
          if (n.hasMore && !searching && !loadState[id]) rows.push({ kind: 'more', depth: depth + 1, node: n });
          if (!n.children.length && !n.hasMore && !loadState[id] && !branchesOnly) rows.push({ kind: 'empty', depth: depth + 1, node: n });
        }
        statusRows(id, depth + 1, n);
      });
    };
    if (serverSearch) {
      (results?.nodes || []).forEach((n, i) => rows.push({ kind: 'node', node: n, depth: 0, parentId: null, posinset: i + 1, setsize: results.nodes.length, guides: [], open: false, result: true }));
      if (results?.loading) rows.push({ kind: 'loading', depth: 0, node: null });
      else if (results?.error) rows.push({ kind: 'error', depth: 0, node: null, message: results.error, search: true });
      else if (results?.hasMore) rows.push({ kind: 'more', depth: 0, node: null, search: true });
      else if (results && !results.nodes.length) rows.push({ kind: 'empty', depth: 0, node: null, search: true });
      return rows;
    }
    walk(nodes, 0, null, []);
    if (rootHasMore && !searching && !loadState[ROOT]) rows.push({ kind: 'more', depth: 0, node: null });
    statusRows(ROOT, 0, null);
    if (!rows.length && !lazyRoot) rows.push({ kind: 'empty', depth: 0, node: null, search: searching });
    return rows;
  };

  // ---------------------------------------------------------------- selection / focus / expansion
  const toggle = (node, open) => {
    if (!node || !isBranch(node)) return;
    const id = String(node.id);
    const isOpen = expandedSet.has(id);
    const next = open ?? !isOpen;
    if (next === isOpen) return;
    setProps({ expanded: next ? [...expandedIds, id] : expandedIds.filter((x) => x !== id) });
    (next ? onExpand : onCollapse)?.(payloadFor(node));
  };
  const focusNode = (node, scroll = true) => {
    if (!node) return;
    const id = String(node.id);
    if (id !== focusId) onNodeFocus?.(payloadFor(node));
    setFocusId(id);
    if (scroll) pendingScroll.current = id;
  };
  const selectable = (node) => selectionMode !== 'none' && node && !node.disabled && node.selectable !== false;
  const emitSelect = (ids, node) => {
    setProps({ selected: ids });
    onSelect?.(payloadFor(node, { selected: ids, nodes: ids.map(nodeById).filter(Boolean) }));
  };
  const select = (node, e, order) => {
    if (!selectable(node)) return;
    const id = String(node.id);
    if (selectionMode === 'multiple' && e?.shiftKey && anchorId.current && order) {
      const a = order.indexOf(anchorId.current);
      const b = order.indexOf(id);
      if (a >= 0 && b >= 0) {
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1).filter((x) => selectable(nodeById(x)));
        emitSelect(e.ctrlKey || e.metaKey ? [...new Set([...selectedIds, ...range])] : range, node);
        return;
      }
    }
    anchorId.current = id;
    if (selectionMode === 'multiple' && (e?.ctrlKey || e?.metaKey)) {
      emitSelect(selectedSet.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id], node);
      return;
    }
    if (selectedIds.length === 1 && selectedIds[0] === id) return;
    emitSelect([id], node);
  };

  // Checkboxes: 1 checked, 0 unchecked, 0.5 partly (some loaded descendants checked)
  const stateCache = new Map();
  const checkState = (node) => {
    const id = String(node.id);
    if (stateCache.has(id)) return stateCache.get(id);
    let state = checkedSet.has(id) ? 1 : 0;
    if (cascadeCheck && Array.isArray(node.children) && node.children.length) {
      const states = node.children.map(checkState);
      state = states.every((s) => s === 1) ? 1 : states.every((s) => s === 0) ? 0 : 0.5;
    }
    stateCache.set(id, state);
    return state;
  };
  const toggleCheck = (node) => {
    if (!node || node.disabled || node.checkable === false) return;
    const on = checkState(node) !== 1;
    const set = new Set(checkedIds);
    [String(node.id), ...(cascadeCheck ? descendantIds(node) : [])].forEach((x) => (on ? set.add(x) : set.delete(x)));
    if (cascadeCheck) {
      [...(findTreeNode(nodesRef.current, node.id)?.ancestors || [])].reverse().forEach((a) => {
        if ((a.children || []).every((c) => set.has(String(c.id)))) set.add(String(a.id)); else set.delete(String(a.id));
      });
    }
    const ids = [...set];
    setProps({ checked: ids });
    onCheck?.(payloadFor(node, { checked: on, checkedIds: ids, checkedNodes: ids.map(nodeById).filter(Boolean) }));
  };

  const activate = (node) => {
    if (!node) return;
    if (view === 'explorer' && isBranch(node)) { navigate(node); return; }
    if (isBranch(node) && view === 'tree') { toggle(node); return; }
    onActivate?.(payloadFor(node));
  };

  // Explorer: open a folder (null = root); also expands it and its parents in the folder pane
  const navigate = (node) => {
    const id = node ? String(node.id) : null;
    const ancestors = node ? (findTreeNode(nodesRef.current, id)?.ancestors || []).map((a) => String(a.id)) : [];
    setProps({ folder: id, expanded: [...new Set([...expandedIds, ...ancestors, ...(id ? [id] : [])])] });
    setPage(1);
    setContentFocus(null);
    if (contentScrollRef.current) contentScrollRef.current.scrollTop = 0;
    onNavigate?.(payloadFor(node, { folder: id }));
  };

  // ---------------------------------------------------------------- rename / delete / context menu
  const startRename = (node) => { if (editable && node && !node.disabled && node.editable !== false) setRenaming({ id: String(node.id), value: labelOf(node) }); };
  const commitRename = async () => {
    const r = renaming;
    setRenaming(null);
    const node = nodeById(r?.id);
    const name = r?.value.trim();
    if (!node || !name || name === labelOf(node)) return;
    const ok = await onRename?.(payloadFor(node, { name, previous: labelOf(node) }));
    if (ok === false || !autoUpdate) return;
    writeNodes(mapTreeNode(nodesRef.current, node.id, (n) => ({ ...n, label: name, ...(n.name !== undefined && { name }) })));
  };
  const requestDelete = (node) => {
    const ids = node && selectedSet.has(String(node.id)) ? selectedIds : node ? [String(node.id)] : selectedIds;
    if (ids.length) onDelete?.(payloadFor(node || nodeById(ids[0]), { ids, nodes: ids.map(nodeById).filter(Boolean) }));
  };
  const openMenu = (node, x, y) => {
    const rect = rootRef.current.getBoundingClientRect();
    const items = contextMenu.filter((item) => !item.when || matchesRule(item.when, { ...node, label: labelOf(node), ext: extOf(node), branch: isBranch(node) }, 'label'));
    onContextMenu?.(payloadFor(node));
    if (items.length) setMenu({ node, items, x: x - rect.left, y: y - rect.top });
  };
  const runMenuItem = (item, node) => {
    setMenu(null);
    const payload = payloadFor(node, { item: item.text ?? item.label });
    switch (item.command) {
      case 'rename': startRename(node); break;
      case 'expand': toggle(node, true); break;
      case 'collapse': toggle(node, false); break;
      case 'reload': reload(node); break;
      case 'open': activate(node); break;
      case 'delete': requestDelete(node); break;
      default: { const action = item.onClick ?? item.action; if (action) runAction(actions, action, payload, { name: nodeId, node }); }
    }
  };
  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => { if (!e.target.closest?.('.rt-menu')) setMenu(null); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menu]);

  // ---------------------------------------------------------------- drag & drop (tree view)
  const dropPosition = (e, node) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = (e.clientY - rect.top) / rect.height;
    if (isBranch(node) && !needsLoad(node) && y > 0.25 && y < 0.75) return 'inside';
    return y < 0.5 ? 'before' : 'after';
  };
  const canDropOn = (target) => {
    if (!dragId.current || !target || String(target.id) === dragId.current) return false;
    return !(findTreeNode(nodesRef.current, target.id)?.ancestors || []).some((a) => String(a.id) === dragId.current);
  };
  const doDrop = async (target, position) => {
    const id = dragId.current;
    dragId.current = null;
    setDrop(null);
    const moving = findTreeNode(nodesRef.current, id);
    const dest = findTreeNode(nodesRef.current, target.id);
    if (!moving || !dest) return;
    let parentId;
    let index;
    if (position === 'inside') { parentId = String(target.id); index = (target.children || []).length; } else {
      parentId = dest.parent ? String(dest.parent.id) : null;
      index = dest.index + (position === 'after' ? 1 : 0);
      const sameParent = String(moving.parent?.id ?? '') === String(parentId ?? '');
      if (sameParent && moving.index < index) index -= 1;
    }
    const ok = await onMove?.(payloadFor(moving.node, { target, position, parentId, index }));
    if (ok === false || !autoUpdate) return;
    writeNodes(moveTreeNode(nodesRef.current, id, parentId, index));
    if (position === 'inside') toggle(target, true);
  };

  // ---------------------------------------------------------------- scrolling
  const treeRows = view === 'tree' ? flatten() : view === 'explorer' ? flatten({ branchesOnly: true, searching: false }) : [];
  // Scroll the focused / requested row into view
  useEffect(() => {
    const id = pendingScroll.current;
    const el = treeScrollRef.current;
    if (!id || !el) return;
    const index = treeRows.findIndex((r) => r.kind === 'node' && String(r.node.id) === id);
    if (index < 0) return;
    pendingScroll.current = null;
    const top = index * rowHeight;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + rowHeight - el.clientHeight;
  });
  // scrollToTreeNode / selectTreeNode from code: expand the parents, focus and scroll
  useEffect(() => {
    if (!scrollRequest?.id) return;
    const found = findTreeNode(nodesRef.current, scrollRequest.id);
    if (!found) return;
    const ancestors = found.ancestors.map((a) => String(a.id));
    if (ancestors.some((a) => !expandedSet.has(a))) setProps({ expanded: [...new Set([...expandedIds, ...ancestors])] });
    setFocusId(String(found.node.id));
    pendingScroll.current = String(found.node.id);
  }, [scrollRequest?.at]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Load more" rows that scroll into view load the next page
  const onTreeVisible = (start, end) => {
    if (loadMore !== 'scroll') return;
    for (let i = start; i < end; i += 1) {
      const row = treeRows[i];
      if (row?.kind !== 'more') continue;
      if (row.search) { if (!results?.loading) runSearch(search.trim(), true); } else load(row.node, true);
    }
  };
  const scrollEndCount = useRef(-1);
  const reachedBottom = (count) => {
    if (scrollEndCount.current === count) return;
    scrollEndCount.current = count;
    onScrollEnd?.({ tree: nodeId, count });
  };

  // ---------------------------------------------------------------- keyboard (tree pane)
  const nodeRows = treeRows.filter((r) => r.kind === 'node');
  const treeKeyDown = (e) => {
    if (renaming || !nodeRows.length) return;
    const idx = nodeRows.findIndex((r) => String(r.node.id) === focusId);
    const row = nodeRows[idx];
    const order = nodeRows.map((r) => String(r.node.id));
    const go = (i) => {
      const target = nodeRows[Math.max(0, Math.min(nodeRows.length - 1, i))];
      focusNode(target.node);
      if (e.shiftKey && selectionMode === 'multiple') select(target.node, { shiftKey: true }, order);
      else if (view === 'explorer') navigate(target.node);
    };
    const handled = () => { e.preventDefault(); e.stopPropagation(); };
    switch (e.key) {
      case 'ArrowDown': handled(); go(idx + 1); return;
      case 'ArrowUp': handled(); go(idx < 0 ? 0 : idx - 1); return;
      case 'Home': handled(); go(0); return;
      case 'End': handled(); go(nodeRows.length - 1); return;
      case 'ArrowRight':
        handled();
        if (!row) { go(0); return; }
        if (isBranch(row.node) && !row.open) toggle(row.node, true);
        else if (row.open && nodeRows[idx + 1]?.parentId === String(row.node.id)) go(idx + 1);
        return;
      case 'ArrowLeft': {
        handled();
        if (!row) return;
        if (row.open && !clientSearch) { toggle(row.node, false); return; }
        const parentIdx = nodeRows.findIndex((r) => String(r.node.id) === row.parentId);
        if (parentIdx >= 0) go(parentIdx);
        return;
      }
      case 'Enter': handled(); if (row) { onNodeDoubleClick?.(payloadFor(row.node)); activate(row.node); } return;
      case ' ': handled(); if (row) { if (checkboxes) toggleCheck(row.node); else select(row.node, e, order); } return;
      case '*': handled(); if (row) nodeRows.filter((r) => r.parentId === row.parentId && isBranch(r.node)).forEach((r) => toggle(r.node, true)); return;
      case 'F2': handled(); if (row) startRename(row.node); return;
      case 'Delete': handled(); requestDelete(row?.node); return;
      case 'ContextMenu': handled(); if (row) { const r = rootRef.current.getBoundingClientRect(); openMenu(row.node, r.left + 40, r.top + 80); } return;
      case 'Escape': setMenu(null); return;
      default: break;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && selectionMode === 'multiple') {
      handled();
      const ids = order.filter((x) => selectable(nodeById(x)));
      emitSelect(ids, row?.node || nodeRows[0].node);
      return;
    }
    // Type-ahead: jump to the next node whose label starts with the typed text
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      typeAhead.current = { text: (now - typeAhead.current.at < 700 ? typeAhead.current.text : '') + e.key.toLowerCase(), at: now };
      const text = typeAhead.current.text;
      const from = idx + (text.length === 1 ? 1 : 0);
      const ordered = [...nodeRows.slice(Math.max(0, from)), ...nodeRows.slice(0, Math.max(0, from))];
      const hit = ordered.find((r) => labelOf(r.node).toLowerCase().startsWith(text));
      if (hit) { handled(); focusNode(hit.node); }
    }
  };

  // ---------------------------------------------------------------- rendering pieces
  const iconFor = (node, open, size = 18) => {
    if (node.icon) return <span className="rt-icon" style={{ fontSize: size * 0.85 }} aria-hidden="true">{node.icon}</span>;
    return <span className="rt-icon" style={{ width: size, height: size }}>{isBranch(node) ? <FolderIcon open={open} size={size} /> : <FileIcon size={size} color={node.color || fileKindColor({ name: labelOf(node), type: node.mime || '' })} />}</span>;
  };
  const labelView = (node) => (renaming?.id === String(node.id) ? (
    <Form.Control autoFocus size="sm" className="rt-rename" value={renaming.value} aria-label={t('tree.rename')}
      onFocus={(e) => { const dot = e.target.value.lastIndexOf('.'); e.target.setSelectionRange(0, dot > 0 && !isBranch(node) ? dot : e.target.value.length); }}
      onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(null); }}
      onBlur={commitRename} onClick={(e) => e.stopPropagation()} />
  ) : <span className="rt-label">{highlight(labelOf(node))}</span>);

  const statusRow = (row, style, key) => {
    const pad = 8 + row.depth * indent + 24;
    const base = { ...style, paddingLeft: pad };
    if (row.kind === 'loading') return <div key={key} className="rt-row rt-note" style={base}><Spinner animation="border" size="sm" />{t('tree.loading')}</div>;
    if (row.kind === 'empty') return <div key={key} className="rt-row rt-note" style={base}>{row.search ? t('tree.noMatches') : (row.node ? t('tree.emptyFolder') : (emptyText || t('tree.empty')))}</div>;
    if (row.kind === 'error') {
      return (
        <div key={key} className="rt-row rt-note rc-text-danger" style={base}>
          {row.message}
          <Button size="sm" variant="link" className="rc-p-0" onClick={() => (row.search ? runSearch(search.trim()) : retry(row.node))}>{t('tree.retry')}</Button>
        </div>
      );
    }
    // more
    return (
      <div key={key} className="rt-row rt-note" style={base}>
        <Button size="sm" variant="link" className="rc-p-0" onClick={() => (row.search ? runSearch(search.trim(), true) : load(row.node, true))}>
          {t('tree.loadMore')}
        </Button>
      </div>
    );
  };

  const nodeRow = (row, style, pane) => {
    const { node, depth } = row;
    const id = String(node.id);
    const branch = isBranch(node);
    const loadingHere = loadState[id] === 'loading';
    const current = pane === 'folders' && String(folder ?? '') === id;
    const order = nodeRows.map((r) => String(r.node.id));
    const state = checkboxes ? checkState(node) : 0;
    const classes = [
      'rt-row',
      (pane === 'folders' ? current : selectedSet.has(id)) && 'rt-sel',
      focusId === id && 'rt-focus',
      node.disabled && 'rt-disabled',
      drop?.id === id && `rt-drop-${drop.position}`,
      node.className,
    ].filter(Boolean).join(' ');
    return (
      <div key={id} id={`${domId}-${id}`} role="treeitem" aria-level={depth + 1} aria-setsize={row.setsize} aria-posinset={row.posinset}
        aria-expanded={branch ? row.open : undefined} aria-selected={selectionMode !== 'none' ? selectedSet.has(id) || current : undefined}
        aria-checked={checkboxes ? (state === 0.5 ? 'mixed' : state === 1) : undefined} aria-disabled={node.disabled || undefined}
        className={classes} style={{ ...style, paddingLeft: 6 + depth * indent }} title={node.title || labelOf(node)}
        draggable={draggable && pane === 'tree' && node.draggable !== false && !node.disabled}
        onClick={(e) => {
          focusNode(node, false);
          if (e.target.closest('[data-twisty]')) { toggle(node); return; }
          if (e.target.closest('input')) return;
          if (pane === 'folders') navigate(node); else select(node, e, order);
          onNodeClick?.(payloadFor(node));
        }}
        onDoubleClick={(e) => {
          if (e.target.closest('[data-twisty], input')) return;
          onNodeDoubleClick?.(payloadFor(node));
          if (pane === 'folders') toggle(node); else activate(node);
        }}
        onContextMenu={(e) => { if (!contextMenu.length && !onContextMenu) return; e.preventDefault(); focusNode(node, false); if (!selectedSet.has(id) && pane !== 'folders') select(node, {}, order); openMenu(node, e.clientX, e.clientY); }}
        onDragStart={(e) => { dragId.current = id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); }}
        onDragOver={(e) => { if (!canDropOn(node)) return; e.preventDefault(); const position = dropPosition(e, node); if (drop?.id !== id || drop.position !== position) setDrop({ id, position }); }}
        onDrop={(e) => { e.preventDefault(); if (drop?.id === id) doDrop(node, drop.position); }}
        onDragEnd={() => { dragId.current = null; setDrop(null); }}>
        {showLines && row.guides.map((more, level) => more && (
          <span key={level} className="rt-guide" style={{ left: 6 + level * indent + 9 }} />
        ))}
        {branch ? (
          <button type="button" tabIndex={-1} data-twisty className={`rt-twisty ${row.open ? 'rt-open' : ''}`} aria-hidden="true">
            {loadingHere && !Array.isArray(node.children) ? <Spinner animation="border" style={{ width: 12, height: 12, borderWidth: 2 }} /> : <Chevron />}
          </button>
        ) : <span className="rt-twisty" aria-hidden="true" />}
        {checkboxes && (
          <input type="checkbox" className="rc-form-check-input rc-m-0 rc-me-1" tabIndex={-1} aria-hidden="true" disabled={node.disabled || node.checkable === false}
            checked={state === 1} ref={(el) => { if (el) el.indeterminate = state === 0.5; }} onChange={() => toggleCheck(node)} />
        )}
        {showIcons && iconFor(node, row.open)}
        {labelView(node)}
        {row.result && <span className="rt-sub rc-ms-2">{(findTreeNode(nodes, id)?.ancestors || []).map(labelOf).join(' / ') || node.path}</span>}
        {node.description && <span className="rt-sub rc-ms-2">{node.description}</span>}
        {(node.badge !== undefined || (showCount && Array.isArray(node.children))) && (
          <span className="rt-badge">{node.badge ?? `${node.children.length}${node.hasMore ? '+' : ''}`}</span>
        )}
      </div>
    );
  };

  const treePane = (rows, pane, paneHeight) => (
    <VirtualRows count={rows.length} rowHeight={rowHeight} height={paneHeight} scrollRef={treeScrollRef}
      role="tree" aria-label={title || t('tree.label')} aria-multiselectable={selectionMode === 'multiple' || undefined}
      tabIndex={0} aria-activedescendant={focusId ? `${domId}-${focusId}` : undefined}
      onKeyDown={treeKeyDown}
      onFocus={(e) => { if (e.target === e.currentTarget && !focusId && nodeRows[0]) focusNode(nodeRows[0].node); }}
      onVisible={onTreeVisible} onBottom={() => reachedBottom(rows.length)}
      renderRow={(i, style) => {
        const row = rows[i];
        return row.kind === 'node' ? nodeRow(row, style, pane) : statusRow(row, style, `${row.kind}-${row.node?.id ?? ROOT}-${i}`);
      }} />
  );

  // ---------------------------------------------------------------- toolbar
  const toggleFilter = (fid) => {
    const id = String(fid);
    const next = activeFilters.includes(id) ? activeFilters.filter((x) => x !== id) : [...activeFilters, id];
    setProps({ activeFilters: next });
    onFilterChange?.({ tree: nodeId, activeFilters: next, filters: filters.filter((f) => next.includes(String(f.id))) });
  };
  const viewLabels = { tree: t('tree.views.tree'), explorer: t('tree.views.explorer'), columns: t('tree.views.columns') };
  const toolbarView = toolbar && (
    <div className="rc-d-flex rc-flex-wrap rc-align-items-center rc-gap-2 rc-mb-2">
      {title && <h6 className="rc-mb-0 rc-me-2">{title}</h6>}
      {searchable && (
        <Form.Control size="sm" type="search" style={{ maxWidth: 240 }} value={search} placeholder={searchPlaceholder || t('tree.search')}
          aria-label={searchPlaceholder || t('tree.search')} onChange={(e) => setProps({ search: e.target.value })} />
      )}
      {filters.map((f) => (
        <button key={f.id} type="button" className="rt-chip" aria-pressed={activeFilters.includes(String(f.id))} onClick={() => toggleFilter(f.id)}>{f.label}</button>
      ))}
      <div className="rc-ms-auto rc-d-flex rc-flex-wrap rc-gap-2 rc-align-items-center">
        {toolbarButtons(toolbarActions, actions, () => ({ tree: nodeId, name: nodeId, selected: selectedIds, checked: checkedIds, nodes: selectedIds.map(nodeById).filter(Boolean) }),
          { hasSelection: selectedIds.length > 0 })}
        {selectionMode === 'multiple' && selectedIds.length > 1 && <span className="rc-small rc-text-muted">{t('tree.selectedCount', { count: selectedIds.length })}</span>}
        {checkboxes && checkedIds.length > 0 && <span className="rc-small rc-text-muted">{t('tree.checkedCount', { count: checkedIds.length })}</span>}
        {view === 'tree' && (
          <>
            <Button size="sm" variant="outline-secondary" onClick={() => setProps({ expanded: allBranchIds() })}>{t('tree.expandAll')}</Button>
            <Button size="sm" variant="outline-secondary" onClick={() => setProps({ expanded: [] })}>{t('tree.collapseAll')}</Button>
          </>
        )}
        {views.length > 1 && (
          <ButtonGroup size="sm" aria-label={t('tree.view')}>
            {views.filter((v) => TREE_VIEWS.includes(v)).map((v) => (
              <Button key={v} variant={v === view ? 'primary' : 'outline-secondary'} aria-pressed={v === view} onClick={() => setProps({ view: v })}>{viewLabels[v]}</Button>
            ))}
          </ButtonGroup>
        )}
      </div>
    </div>
  );

  // ================================================================ views
  let body = null;

  if (view === 'tree') {
    body = <div className="rt-pane">{treePane(treeRows, 'tree', height)}</div>;
  }

  if (view === 'explorer') {
    const folderFound = folder != null ? findTreeNode(nodes, folder) : null;
    const folderNode = folderFound?.node || null;
    const folderKey = folderNode ? String(folderNode.id) : ROOT;
    const loaded = folderNode ? (folderNode.children || []) : nodes;
    const hasMore = folderNode ? folderNode.hasMore : rootHasMore;
    const status = loadState[folderKey];
    let items = serverSearch ? (results?.nodes || []) : loaded.filter((n) => passesFilter(n) && (!clientSearch || labelOf(n).toLowerCase().includes(q)));
    const dir = sort.dir === 'asc' ? 1 : -1;
    const sortColumn = columns.find((c) => c.key === sort.key);
    items = [...items].sort((a, b) => {
      const branchOrder = Number(isBranch(b)) - Number(isBranch(a));
      if (branchOrder) return branchOrder;
      const va = sort.key === 'label' ? labelOf(a) : sort.key === 'kind' ? kindOf(a) : a[sort.key];
      const vb = sort.key === 'label' ? labelOf(b) : sort.key === 'kind' ? kindOf(b) : b[sort.key];
      if (sortColumn?.format === 'bytes' || typeof va === 'number') return dir * ((Number(va) || 0) - (Number(vb) || 0));
      return dir * String(va ?? '').localeCompare(String(vb ?? ''), locale, { numeric: true, sensitivity: 'base' });
    });
    const paged = contentPaging === 'pages';
    const pageCount = Math.max(1, Math.ceil(items.length / pageSize) + (hasMore && !serverSearch ? 1 : 0));
    const currentPage = Math.min(page, pageCount);
    const shown = paged ? items.slice((currentPage - 1) * pageSize, currentPage * pageSize) : items;
    const order = shown.map((n) => String(n.id));
    const moreAvailable = serverSearch ? results?.hasMore : hasMore;
    const loadNext = () => {
      if (serverSearch) { if (!results?.loading) runSearch(search.trim(), true); } else if (!status) load(folderNode, true);
    };
    // Pages: reaching a page past the loaded items loads the next batch (in the effect below)
    nextPage.current = paged && currentPage === pageCount && moreAvailable && shown.length < pageSize && !status && !results?.loading ? loadNext : null;

    const crumbs = [null, ...(folderFound?.ancestors || []), ...(folderNode ? [folderNode] : [])];
    const contentHeight = height - 44 - (contentView === 'details' ? 30 : 0) - (paged ? 40 : 0) - 26;
    const gridTemplate = columns.map((c) => c.width || 'minmax(160px, 1fr)').join(' ');

    const itemHandlers = (n) => ({
      onClick: (e) => { setContentFocus(String(n.id)); select(n, e, order); onNodeClick?.(payloadFor(n)); },
      onDoubleClick: () => { onNodeDoubleClick?.(payloadFor(n)); activate(n); },
      onContextMenu: (e) => { if (!contextMenu.length && !onContextMenu) return; e.preventDefault(); if (!selectedSet.has(String(n.id))) select(n, {}, order); openMenu(n, e.clientX, e.clientY); },
    });
    const contentKeyDown = (e) => {
      if (renaming) return;
      const idx = order.indexOf(contentFocus);
      const goTo = (i) => {
        const n = shown[Math.max(0, Math.min(shown.length - 1, i))];
        if (!n) return;
        setContentFocus(String(n.id));
        select(n, e.shiftKey ? e : {}, order);
        onNodeFocus?.(payloadFor(n));
        const el = contentScrollRef.current;
        const index = shown.indexOf(n);
        if (el && contentView !== 'icons') {
          const top = index * rowHeight;
          if (top < el.scrollTop) el.scrollTop = top;
          else if (top + rowHeight > el.scrollTop + el.clientHeight) el.scrollTop = top + rowHeight - el.clientHeight;
        }
      };
      const n = shown[idx];
      const keys = {
        ArrowDown: () => goTo(idx + 1), ArrowUp: () => goTo(idx - 1), Home: () => goTo(0), End: () => goTo(shown.length - 1),
        ArrowRight: () => contentView === 'icons' && goTo(idx + 1), ArrowLeft: () => contentView === 'icons' && goTo(idx - 1),
        Enter: () => n && activate(n), Backspace: () => folderNode && navigate(folderFound.parent),
        F2: () => n && startRename(n), Delete: () => requestDelete(n),
        a: () => (e.ctrlKey || e.metaKey) && selectionMode === 'multiple' && emitSelect(order, shown[0]),
      };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    };
    const contentStatus = (
      <>
        {(status === 'loading' || results?.loading) && <div className="rt-note rc-p-2"><Spinner animation="border" size="sm" />{t('tree.loading')}</div>}
        {status?.startsWith('error:') && (
          <div className="rt-note rc-p-2 rc-text-danger">{status.slice(6)}<Button size="sm" variant="link" className="rc-p-0" onClick={() => retry(folderNode)}>{t('tree.retry')}</Button></div>
        )}
        {!status && !results?.loading && !shown.length && (
          <div className="rt-note rc-p-3 rc-justify-content-center">{q || filterDefs.length ? t('tree.noMatches') : t('tree.emptyFolder')}</div>
        )}
        {loadMore === 'button' && !paged && moreAvailable && !status && (
          <div className="rc-p-2 rc-text-center"><Button size="sm" variant="outline-secondary" onClick={loadNext}>{t('tree.loadMore')}</Button></div>
        )}
      </>
    );
    const onContentBottom = () => { if (!paged && loadMore === 'scroll' && moreAvailable) loadNext(); reachedBottom(items.length); };

    let content;
    if (contentView === 'icons') {
      content = (
        <div ref={contentScrollRef} className="rt-scroll" style={{ height: contentHeight }} tabIndex={0} onKeyDown={contentKeyDown}
          role="listbox" aria-label={labelOf(folderNode) || rootLabel || t('tree.root')} aria-multiselectable={selectionMode === 'multiple' || undefined}
          onScroll={(e) => { const el = e.currentTarget; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) onContentBottom(); }}>
          <div className="rt-tiles">
            {shown.map((n) => (
              <div key={n.id} role="option" aria-selected={selectedSet.has(String(n.id))} title={labelOf(n)}
                className={`rt-tile ${selectedSet.has(String(n.id)) ? 'rt-sel' : ''} ${contentFocus === String(n.id) ? 'rt-focus' : ''}`} {...itemHandlers(n)}>
                {n.thumbnail ? <img src={n.thumbnail} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} /> : iconFor(n, false, 44)}
                {labelView(n)}
              </div>
            ))}
          </div>
          {contentStatus}
        </div>
      );
    } else {
      const details = contentView === 'details';
      content = (
        <>
          {details && (
            <div className="rt-head" style={{ gridTemplateColumns: gridTemplate }} role="row">
              {columns.map((c) => (
                <button key={c.key} type="button" role="columnheader" style={{ textAlign: c.align === 'end' ? 'right' : 'left' }}
                  aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : 'asc' }))}>
                  {columnTitle(c)}{sort.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                </button>
              ))}
            </div>
          )}
          <VirtualRows count={shown.length + 1} rowHeight={rowHeight} height={contentHeight} scrollRef={contentScrollRef}
            tabIndex={0} onKeyDown={contentKeyDown} role="grid" aria-label={labelOf(folderNode) || rootLabel || t('tree.root')}
            aria-multiselectable={selectionMode === 'multiple' || undefined} onBottom={onContentBottom}
            renderRow={(i, style) => {
              if (i === shown.length) return <div key="status" style={{ position: 'absolute', top: style.top, left: 0, right: 0 }}>{contentStatus}</div>;
              const n = shown[i];
              const id = String(n.id);
              return (
                <div key={id} role="row" aria-selected={selectedSet.has(id)} title={labelOf(n)}
                  className={`rt-row ${details ? 'rt-grid-row' : ''} ${selectedSet.has(id) ? 'rt-sel' : ''} ${contentFocus === id ? 'rt-focus' : ''}`}
                  style={{ ...style, ...(details ? { gridTemplateColumns: gridTemplate, gap: 0, paddingLeft: 0 } : { paddingLeft: 8 }) }} {...itemHandlers(n)}>
                  {details ? columns.map((c) => (
                    <div key={c.key} role="gridcell" style={{ textAlign: c.align === 'end' ? 'right' : 'left', ...(c.key === 'label' && { display: 'flex', alignItems: 'center', gap: 6 }) }}
                      className={c.key === 'label' ? '' : 'rt-sub'}>
                      {c.key === 'label' ? <>{showIcons && iconFor(n, false)}{labelView(n)}</> : cellText(n, c)}
                    </div>
                  )) : <>{showIcons && iconFor(n, false)}{labelView(n)}</>}
                </div>
              );
            }} />
        </>
      );
    }

    const selectedInFolder = items.filter((n) => selectedSet.has(String(n.id)));
    const selectedBytes = selectedInFolder.reduce((s, n) => s + (Number(n.size) || 0), 0);
    body = (
      <div className="rc-d-flex rc-gap-2" style={{ height }}>
        <div className="rt-pane rc-d-none rc-d-md-flex" style={{ width: 260, flex: 'none' }}>
          {treePane(treeRows, 'folders', height - 2)}
        </div>
        <div className="rt-pane rc-flex-grow-1">
          <div className="rc-d-flex rc-align-items-center rc-gap-1 rc-px-2 rc-border-bottom" style={{ height: 44 }}>
            <button type="button" className="rt-twisty" style={{ width: 28, height: 28 }} disabled={!folderNode} aria-label={t('tree.up')} title={t('tree.up')}
              onClick={() => navigate(folderFound?.parent || null)}>↑</button>
            <button type="button" className="rt-twisty" style={{ width: 28, height: 28 }} aria-label={t('tree.refresh')} title={t('tree.refresh')}
              onClick={() => reload(folderNode)}>↻</button>
            <nav className="rt-crumbs rc-flex-grow-1" aria-label={t('tree.path')}>
              {crumbs.map((c, i) => (
                <span key={c ? c.id : ROOT} className="rc-d-flex rc-align-items-center">
                  {i > 0 && <span className="rc-text-muted rc-px-1">›</span>}
                  <button type="button" aria-current={i === crumbs.length - 1 ? 'page' : undefined} onClick={() => navigate(c)}>{c ? labelOf(c) : (rootLabel || t('tree.root'))}</button>
                </span>
              ))}
            </nav>
            <ButtonGroup size="sm" aria-label={t('tree.layout')}>
              {['details', 'list', 'icons'].map((v) => (
                <Button key={v} variant={contentView === v ? 'secondary' : 'outline-secondary'} aria-pressed={contentView === v}
                  onClick={() => setProps({ contentView: v })}>{t(`tree.layouts.${v}`)}</Button>
              ))}
            </ButtonGroup>
          </div>
          {content}
          {paged && (
            <div className="rc-d-flex rc-align-items-center rc-justify-content-end rc-gap-2 rc-px-2 rc-border-top" style={{ height: 40 }}>
              <Button size="sm" variant="outline-secondary" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>‹</Button>
              <span className="rc-small">{t('tree.page', { page: currentPage, pages: `${pageCount}${moreAvailable ? '+' : ''}` })}</span>
              <Button size="sm" variant="outline-secondary" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>›</Button>
            </div>
          )}
          <div className="rc-d-flex rc-gap-3 rc-px-2 rc-border-top rc-small rc-text-muted rc-align-items-center" style={{ height: 26 }}>
            <span>{t('tree.itemCount', { count: items.length })}{moreAvailable ? '+' : ''}</span>
            {selectedInFolder.length > 0 && <span>{t('tree.selectedCount', { count: selectedInFolder.length })}{selectedBytes ? ` · ${formatBytes(selectedBytes, locale)}` : ''}</span>}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'columns') {
    const columnLists = [{ parent: null, items: nodes, hasMore: rootHasMore, key: ROOT }];
    columnsPath.forEach((id) => {
      const node = findTreeNode(nodes, id)?.node;
      if (node && isBranch(node)) columnLists.push({ parent: node, items: node.children || [], hasMore: node.hasMore, key: id });
    });
    const lastId = columnsPath[columnsPath.length - 1];
    const lastNode = lastId ? findTreeNode(nodes, lastId)?.node : null;
    const pick = (level, node, e) => {
      const id = String(node.id);
      setProps({ columnsPath: [...columnsPath.slice(0, level), id] });
      select(node, e);
      setFocusId(id);
      onNodeFocus?.(payloadFor(node));
      if (isBranch(node)) onNavigate?.(payloadFor(node, { folder: id }));
      setTimeout(() => { const el = rootRef.current?.querySelector('.rt-columns'); if (el) el.scrollLeft = el.scrollWidth; }, 0);
    };
    const columnKeyDown = (level, list) => (e) => {
      const idx = list.findIndex((n) => String(n.id) === columnsPath[level]);
      const keys = {
        ArrowDown: () => list[idx + 1] && pick(level, list[idx + 1], {}),
        ArrowUp: () => list[Math.max(0, idx - 1)] && pick(level, list[Math.max(0, idx - 1)], {}),
        ArrowRight: () => { const node = list[idx]; const kids = node?.children || []; if (isBranch(node) && kids[0]) { pick(level + 1, kids[0], {}); rootRef.current?.querySelectorAll('.rt-col')[level + 1]?.focus(); } },
        ArrowLeft: () => { if (level > 0) { setProps({ columnsPath: columnsPath.slice(0, level) }); rootRef.current?.querySelectorAll('.rt-col')[level - 1]?.focus(); } },
        Enter: () => list[idx] && activate(list[idx]),
      };
      if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
    };
    body = (
      <div className="rt-pane" style={{ height }}>
        <div className="rt-columns" style={{ height: '100%' }}>
          {columnLists.map((col, level) => {
            const list = col.items.filter((n) => passesFilter(n) && (!clientSearch || labelOf(n).toLowerCase().includes(q)));
            const status = loadState[col.key];
            return (
              <div key={col.key} className="rt-col" role="listbox" tabIndex={0} aria-label={col.parent ? labelOf(col.parent) : (rootLabel || t('tree.root'))}
                onKeyDown={columnKeyDown(level, list)}
                onScroll={(e) => { const el = e.currentTarget; if (loadMore === 'scroll' && col.hasMore && !status && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) load(col.parent, true); }}>
                {list.map((n) => {
                  const id = String(n.id);
                  const inPath = columnsPath[level] === id;
                  return (
                    <div key={id} role="option" aria-selected={inPath} title={labelOf(n)}
                      className={`rt-row ${inPath ? 'rt-sel' : ''} ${focusId === id ? 'rt-focus' : ''}`} style={{ height: rowHeight, paddingLeft: 8 }}
                      onClick={(e) => { pick(level, n, e); onNodeClick?.(payloadFor(n)); }}
                      onDoubleClick={() => { onNodeDoubleClick?.(payloadFor(n)); if (!isBranch(n)) activate(n); }}
                      onContextMenu={(e) => { if (!contextMenu.length && !onContextMenu) return; e.preventDefault(); openMenu(n, e.clientX, e.clientY); }}>
                      {showIcons && iconFor(n, inPath)}
                      {labelView(n)}
                      {isBranch(n) && <span className="rc-ms-auto rc-text-muted"><Chevron /></span>}
                    </div>
                  );
                })}
                {status === 'loading' && <div className="rt-note rc-p-2"><Spinner animation="border" size="sm" />{t('tree.loading')}</div>}
                {status?.startsWith('error:') && <div className="rt-note rc-p-2 rc-text-danger">{status.slice(6)}<Button size="sm" variant="link" className="rc-p-0" onClick={() => retry(col.parent)}>{t('tree.retry')}</Button></div>}
                {!status && col.hasMore && <div className="rc-p-2"><Button size="sm" variant="link" className="rc-p-0" onClick={() => load(col.parent, true)}>{t('tree.loadMore')}</Button></div>}
                {!status && !list.length && <div className="rt-note rc-p-2">{q ? t('tree.noMatches') : t('tree.emptyFolder')}</div>}
              </div>
            );
          })}
          {lastNode && !isBranch(lastNode) && (
            <div className="rt-col rc-p-3 rc-text-center" style={{ width: 280 }}>
              <div className="rc-my-3">{lastNode.thumbnail ? <img src={lastNode.thumbnail} alt="" style={{ maxWidth: '100%', borderRadius: 6 }} /> : iconFor(lastNode, false, 64)}</div>
              <div className="rc-fw-semibold rc-text-break rc-mb-2">{labelOf(lastNode)}</div>
              {columns.filter((c) => c.key !== 'label').map((c) => cellText(lastNode, c) && (
                <div key={c.key} className="rc-d-flex rc-justify-content-between rc-small rc-border-top rc-py-1"><span className="rc-text-muted">{columnTitle(c)}</span><span>{cellText(lastNode, c)}</span></div>
              ))}
              <Button size="sm" className="rc-mt-3" onClick={() => activate(lastNode)}>{t('tree.open')}</Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const menuView = menu && (
    <div className="rt-menu" role="menu" style={{ left: Math.min(menu.x, (rootRef.current?.clientWidth || 400) - 190), top: menu.y }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setMenu(null);
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const buttons = [...e.currentTarget.querySelectorAll('button')];
          const i = buttons.indexOf(document.activeElement);
          buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      {menu.items.map((item, i) => (item.divider ? <hr key={`d${i}`} /> : (
        <button key={item.key ?? item.text ?? item.label} type="button" role="menuitem" autoFocus={i === 0} disabled={item.disabled} onClick={() => runMenuItem(item, menu.node)}>
          {item.icon && <span aria-hidden="true">{item.icon}</span>}{item.text ?? item.label}
        </button>
      )))}
    </div>
  );

  return (
    <div ref={rootRef} data-rcube-tree={nodeId} className={`rcube-tree rc-mb-3 ${className}`.trim()} style={style}>
      <style>{TREE_CSS}</style>
      {toolbarView}
      {body}
      {menuView}
    </div>
  );
};

// Schemas use it by name (registered when this module loads: 'rcube-html', or 'rcube-html/tree' with 'rcube-html/core')
registerComponent('Tree', Tree);
