import { useEffect, useMemo, useRef, useState } from "react";
import { Badge as BsBadge, Button, Card as BsCard, Dropdown, Form, Pagination, Spinner, Table } from "./ui";
import { InputField, SelectField, runAction } from "./form";
import { useTranslator } from "./i18n";
import { toolbarButtons } from "./toolbar";
import { VIEW_STORE_EVENT, clearView, hasView, readView, saveView } from "./viewStore";
import {
  aggregate, cellFieldName, hiddenColumnsOf, interpolate, leafColumns, normalizeRows, rowKeyOf, stripRowIds,
} from "./tableUtils";

/*
 * DataTable (also "DynamicTable") — schema-driven table.
 *
 * { "type": "DataTable", "id": "orders", "props": {
 *     "name": "orders",                 // include rows in submitted entries under this key
 *     "rowKey": "id",                   // optional stable row identity (default: internal id)
 *     "columns": [ { "key": "id", "title": "#" }, { "key": "qty", "title": "Qty", "editor": { "type": "number", "required": true } } ],
 *     "rows": [ { "id": 1, "qty": 2 } ],
 *     "pageSize": 10, "sortable": true, "searchable": true, "selectable": true, "removable": true,
 *     ("selectable": "single": a radio button per row — one row at a time; clicking a row picks it too)
 *     "addable": true, "exportable": true, "columnToggle": true, "stackBelow": "md" } }
 *
 * The chosen row — selected (checkbox / radio) or, in a table without selection, the row last clicked (onRowClick;
 * "highlightClicked": false turns that off) — is highlighted: tinted, bold, a bar at its start. Its colours: the app's
 * (configureTableLook({ background, color, weight, accent }) or the --rc-table-selected-* CSS variables), or this
 * table's own "selectedLook": { "background": "#fff3cd", "color": "#664d03" } (or { "variant": "warning" }).
 *
 * Schema buttons run form actions by name, called as fn(event, context):
 *   column  { "key": "actions", "actions": [ { "text": "Edit", "onClick": "editOrder()" } ] }  -> { table, name, row, rowKey }
 *   table   "toolbarActions": [ { "text": "Approve", "onClick": "approve()", "needsSelection": true } ] -> { table, name, selected, rows }
 *
 * Rows / columns / selection / hidden columns changed at runtime live in the form's element state
 * (actions.addRow, removeRow, updateRow, setRows, addColumn, removeColumn, toggleColumn, selectRows, ...).
 *
 * Server paging ("serverSide": true): the server pages, sorts and searches; "rows" is the current page only.
 *   "totalRows": 1000, "page": 1        the pager's size and position (from the server's answer)
 *   "onQueryChange": "loadPage()"        -> { page, pageSize, sort, query } when the person changes page, rows per
 *                                           page, sort or search (search waits "searchDelay" ms, default 350)
 *   actions.setPageRows(id, { rows, totalRows, page })   shows the answer (and ends loading)
 *   actions.setTableLoading(id, true)                     a spinner over the table, the pager disabled ("loading")
 * The table puts itself in loading as soon as it asks; CSV export, totals and "select all" work on the page shown.
 *
 * Starting view: "sort": { "key": "name", "dir": "desc" }, "query": "text" (the search box).
 * Remembered view ("remember": "students" or true = the node id): the page, rows per page, sort and search are kept in
 * this browser (viewStore.js: per signed-in person, a week from last use) and come back next time; a "Reset" button
 * shows while anything is saved under the key (also the page's filters saved as "<key>:…") — it forgets them, goes
 * back to the starting view and runs "onViewReset" ({ key }) so the page clears its filters. With server paging the
 * page loads the saved view itself (readView(key) -> { page, pageSize, sort, query }).
 */

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', 'xxl'];
const alignClass = { start: 'rc-text-start', center: 'rc-text-center', end: 'rc-text-end' };

// "YYYY-MM-DD" as a local date (avoids the UTC shift of new Date("YYYY-MM-DD"))
const toDate = (value) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
};

// Display text for a cell value using the column's "format"
export const formatValue = (value, column = {}, t) => {
  if (value === undefined || value === null || value === '') return '';
  const { format, locale, currency = 'USD', decimals } = column;
  const digits = decimals !== undefined ? { minimumFractionDigits: decimals, maximumFractionDigits: decimals } : {};
  const number = Number(value);
  switch (format) {
    case 'number': return Number.isNaN(number) ? String(value) : new Intl.NumberFormat(locale, digits).format(number);
    case 'currency': return Number.isNaN(number) ? String(value) : new Intl.NumberFormat(locale, { style: 'currency', currency, ...digits }).format(number);
    case 'percent': return Number.isNaN(number) ? String(value) : new Intl.NumberFormat(locale, { style: 'percent', ...digits }).format(number);
    case 'date': {
      const date = toDate(value);
      return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString(locale);
    }
    case 'boolean': return value ? (t ? t('table.yes') : 'Yes') : (t ? t('table.no') : 'No');
    default: return String(value);
  }
};

/*
 * Looks: { variant, background, color, className, style }
 *   variant    - table colour: primary, secondary, success, danger, warning, info, light, dark, active
 *   background - any CSS color (drawn through --rc-table-bg-state, so it shows over stripes / hover)
 *   color      - text color (--rc-table-color-state)
 * Used by row data (_variant / _look), rowRules, column look / headerLook / cellRules, hoverRow /
 * hoverColumn / hoverCell and selectedLook. When several apply, later ones win:
 * row → column → cell rules → selected → hover row → hover column → hover cell.
 */
/*
 * The chosen row (selected, or the row last clicked): tinted, bold, with a bar at its start. Colours come from CSS
 * variables, so an app sets them once (configureTableLook, or its own CSS) and a table can still pass "selectedLook":
 *   --rc-table-selected-bg      background            (default: the primary colour, light; it stays while hovered)
 *   --rc-table-selected-color   text                  (default: the emphasis colour)
 *   --rc-table-selected-weight  font weight           (default: 600)
 *   --rc-table-selected-accent  the bar at its start  (default: the primary colour; "transparent": none)
 */
const TABLE_CSS = `
.rc-row-selected,.rc-table>tbody>tr>.rc-row-selected,.rc-table-hover>tbody>tr:hover>.rc-row-selected,.rc-table-striped>tbody>tr:nth-of-type(odd)>.rc-row-selected{--rc-table-bg-state:var(--rc-table-selected-bg,rgba(var(--rc-primary-rgb),.2));--rc-table-color-state:var(--rc-table-selected-color,var(--rc-emphasis-color));font-weight:var(--rc-table-selected-weight,600)}
.rc-table>tbody>tr>.rc-row-selected:first-child{box-shadow:inset 3px 0 0 var(--rc-table-selected-accent,var(--rc-primary)),inset 0 0 0 9999px var(--rc-table-bg-state)}
`;
/** The app's colours for the chosen row: { background, color, weight, accent } (CSS values) on :root */
export const configureTableLook = ({ background, color, weight, accent } = {}) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement.style;
  const set = (name, value) => (value ? root.setProperty(name, String(value)) : root.removeProperty(name));
  set('--rc-table-selected-bg', background); set('--rc-table-selected-color', color);
  set('--rc-table-selected-weight', weight); set('--rc-table-selected-accent', accent);
};
const SELECTED_LOOK = { className: 'rc-row-selected' };

const lookFrom = (look) => {
  if (!look) return null;
  const { variant, background, color, className, style } = look;
  return {
    variant,
    className,
    style: {
      ...(background && { '--rc-table-bg-state': background }),
      ...(color && { '--rc-table-color-state': color }),
      ...style,
    },
  };
};

const mergeLooks = (looks) => looks.filter(Boolean).reduce((merged, look) => ({
  variant: look.variant ?? merged.variant, // only one variant class, so the highest-priority one wins
  classNames: look.className ? [...merged.classNames, look.className] : merged.classNames,
  style: { ...merged.style, ...look.style },
}), { variant: undefined, classNames: [], style: {} });

const lookProps = (merged, baseClass) => ({
  className: [baseClass, merged.variant && `rc-table-${merged.variant}`, ...merged.classNames].filter(Boolean).join(' ') || undefined,
  style: Object.keys(merged.style).length ? merged.style : undefined,
});

/**
 * Rule condition against a row: { field, equals, notEquals, in, notIn, gt, gte, lt, lte, contains, empty }.
 * All given tests must pass; field defaults to the column's key for cellRules.
 */
export const matchesRule = (when = {}, row = {}, defaultField) => {
  const value = row[when.field ?? defaultField];
  const number = Number(value);
  const isEmpty = value === undefined || value === null || value === '';
  if ('equals' in when && String(value) !== String(when.equals)) return false;
  if ('notEquals' in when && String(value) === String(when.notEquals)) return false;
  if (when.in && !when.in.map(String).includes(String(value))) return false;
  if (when.notIn && when.notIn.map(String).includes(String(value))) return false;
  if ('gt' in when && (isEmpty || !(number > when.gt))) return false;
  if ('gte' in when && (isEmpty || !(number >= when.gte))) return false;
  if ('lt' in when && (isEmpty || !(number < when.lt))) return false;
  if ('lte' in when && (isEmpty || !(number <= when.lte))) return false;
  if ('contains' in when && !String(value ?? '').toLowerCase().includes(String(when.contains).toLowerCase())) return false;
  if ('empty' in when && isEmpty !== Boolean(when.empty)) return false;
  return true;
};

const ruleLooks = (rules = [], row, defaultField) => rules
  .filter((rule) => matchesRule(rule.when, row, defaultField))
  .map(lookFrom);

// Sort comparison: numbers numerically, everything else as text
const compareValues = (a, b) => {
  const na = Number(a);
  const nb = Number(b);
  if (a !== '' && b !== '' && a != null && b != null && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' });
};

// Page numbers with ellipses: 1 … 4 5 6 … 20
const pageNumbers = (current, count) => {
  const pages = new Set([1, count, current - 1, current, current + 1].filter((p) => p >= 1 && p <= count));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((p, i) => (i > 0 && p - sorted[i - 1] > 1 ? ['…', p] : [p]));
};

// Header rows for grouped columns: groups span their visible leaves; leaves span the remaining depth
const buildHeaderRows = (columns, hidden) => {
  const depthOf = (cols) => Math.max(1, ...cols.map((c) => (c.children?.length ? 1 + depthOf(c.children) : 1)));
  const visibleLeafCount = (c) => (c.children?.length
    ? c.children.reduce((n, child) => n + visibleLeafCount(child), 0)
    : (hidden.has(c.key) ? 0 : 1));
  const depth = depthOf(columns);
  const rows = Array.from({ length: depth }, () => []);
  const walk = (cols, level) => cols.forEach((column) => {
    const count = visibleLeafCount(column);
    if (!count) return;
    if (column.children?.length) {
      rows[level].push({ column, colSpan: count, rowSpan: 1, group: true });
      walk(column.children, level + 1);
    } else {
      rows[level].push({ column, colSpan: 1, rowSpan: depth - level });
    }
  });
  walk(columns, 0);
  return rows;
};

// Cell spans for the rows on the page: "mergeSame" columns merge consecutive equal values;
// a row's "_spans": { columnKey: { rowSpan, colSpan } } sets explicit spans. null = covered cell.
const computeSpans = (rows, columns) => {
  const info = rows.map(() => columns.map(() => ({ rowSpan: 1, colSpan: 1 })));
  columns.forEach((column, c) => {
    if (!column.mergeSame) return;
    for (let r = 0; r < rows.length;) {
      let n = 1;
      while (r + n < rows.length && String(rows[r + n][column.key] ?? '') === String(rows[r][column.key] ?? '')) n += 1;
      if (n > 1) {
        info[r][c] = { rowSpan: n, colSpan: 1 };
        for (let k = 1; k < n; k += 1) info[r + k][c] = null;
      }
      r += n;
    }
  });
  rows.forEach((row, r) => {
    Object.entries(row._spans || {}).forEach(([key, span]) => {
      const c = columns.findIndex((column) => column.key === key);
      if (c < 0 || !info[r][c]) return;
      const rowSpan = Math.max(1, Math.min(span.rowSpan || 1, rows.length - r));
      const colSpan = Math.max(1, Math.min(span.colSpan || 1, columns.length - c));
      info[r][c] = { rowSpan, colSpan };
      for (let i = 0; i < rowSpan; i += 1) {
        for (let j = 0; j < colSpan; j += 1) if (i || j) info[r + i][c + j] = null;
      }
    });
  });
  return info;
};

// Editable cell: the library's own field components, controlled by the row value
const CellEditor = ({ editor, value, fieldName, error, label, onChange }) => {
  const {
    type = 'text', options, placeholder, required, requiredMessage, pattern, patternMessage, rangeMessage,
    allowedValues, allowedValuesMessage, numberMessage, ...rest
  } = editor;
  const common = { name: fieldName, error, className: 'rc-mb-0', 'aria-label': label, required };
  if (type === 'select') {
    return <SelectField {...common} options={options} placeholder={placeholder} value={value ?? ''} size="sm" onChange={(e) => onChange(e.target.value)} />;
  }
  if (type === 'checkbox') {
    return <InputField {...common} type="checkbox" value={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  }
  return (
    <InputField {...common} {...rest} type={type} placeholder={placeholder} value={value ?? ''} size="sm"
      onChange={(e) => onChange(e.target.value)} />
  );
};

const downloadCsv = (fileName, columns, rows) => {
  const escape = (v) => {
    const text = v === undefined || v === null ? '' : String(v);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.map((c) => escape(c.title ?? c.key)), ...rows.map((row) => columns.map((c) => escape(row[c.key])))]
    .map((line) => line.join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const DataTable = ({
  nodeId, actions, formContext,
  name, columns = [], rows = [], rowKey, selected, hiddenColumns,
  title, caption, emptyText, totalLabel, addLabel, searchPlaceholder, exportFileName,
  pageSize: initialPageSize = 10, pageSizeOptions,
  sortable = false, searchable = false, selectable = false, removable = false, addable = false,
  exportable = false, columnToggle = false,
  responsive = true, stackBelow, stickyHeader = false, maxHeight,
  striped = true, bordered = false, hover = true, size, variant,
  rowRules, hoverRow, hoverColumn, hoverCell, selectedLook = SELECTED_LOOK, highlightClicked = true, toolbarActions,
  className = '', style,
  serverSide = false, totalRows, page: serverPage, loading = false, searchDelay = 350,
  sort: initialSort = null, query: initialQuery = '', remember, onViewReset,
  onRowClick, onSelectionChange, onCellChange, onPageChange, onSortChange, onQueryChange, onSearchChange,
}) => {
  const t = useTranslator();
  const tableName = name || nodeId;
  const errors = formContext?.errors || {};

  const allRows = useMemo(() => normalizeRows(rows), [rows]);
  const leaves = useMemo(() => leafColumns(columns), [columns]);
  const hidden = useMemo(() => new Set(hiddenColumnsOf({ columns, hiddenColumns })), [columns, hiddenColumns]);
  const visible = leaves.filter((column) => !hidden.has(column.key));
  const selectedKeys = useMemo(() => new Set((selected || []).map(String)), [selected]);

  // the remembered view (this browser), read once
  const rememberKey = remember === true ? nodeId : remember || null;
  const saved = useMemo(() => (rememberKey ? readView(rememberKey) : null), [rememberKey]);
  const [sort, setSort] = useState(saved?.sort ?? initialSort); // { key, dir: 'asc' | 'desc' }
  const [query, setQuery] = useState(saved?.query ?? initialQuery);
  const [page, setPage] = useState(serverPage || saved?.page || 1);
  const [pageSize, setPageSize] = useState(saved?.pageSize ?? initialPageSize);
  // keep it while it differs from the starting view (back to it: nothing saved for the table itself)
  useEffect(() => {
    if (!rememberKey) return;
    const plain = page === 1 && pageSize === initialPageSize && !query.trim() && JSON.stringify(sort) === JSON.stringify(initialSort);
    saveView(rememberKey, plain ? null : { page, pageSize, sort, query });
  }, [rememberKey, page, pageSize, sort, query]); // eslint-disable-line react-hooks/exhaustive-deps
  const [canReset, setCanReset] = useState(false);
  useEffect(() => {
    if (!rememberKey) return undefined;
    const check = () => setCanReset(hasView(rememberKey));
    check();
    window.addEventListener(VIEW_STORE_EVENT, check);
    return () => window.removeEventListener(VIEW_STORE_EVENT, check);
  }, [rememberKey]);
  const resetView = () => {
    clearView(rememberKey);
    const start = { page: 1, pageSize: initialPageSize, sort: initialSort, query: initialQuery };
    setSort(start.sort); setQuery(start.query); setPage(1); setPageSize(start.pageSize);
    if (serverSide) ask(start);
    onViewReset?.({ key: rememberKey });
    // the view (back to the start) saved nothing: the button goes
    setTimeout(() => clearView(rememberKey), 0);
  };
  // server paging: the page the server answered with, and "asked, not answered yet"
  const [asking, setAsking] = useState(false);
  useEffect(() => { if (serverSide && serverPage) setPage(serverPage); }, [serverSide, serverPage]);
  // the page whose rows are shown: when a call fails (loading ends, no new rows) the pager goes back to it
  const shownPage = useRef(serverPage || 1);
  useEffect(() => { shownPage.current = serverPage || shownPage.current; setAsking(false); }, [rows, totalRows, serverPage]);
  useEffect(() => {
    if (loading) return;
    if (asking && serverSide) setPage(shownPage.current); // e.g. setTableLoading(id, false) after a failed call
    setAsking(false);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = serverSide && (loading || asking);
  const searchTimer = useRef(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);
  // ask the server for { page, pageSize, sort, query } (the current values, with changes)
  const ask = (change) => {
    const next = { page, pageSize, sort, query: query.trim(), ...change };
    setAsking(true);
    actions?.setTableLoading?.(nodeId, true);
    onQueryChange?.(next);
  };

  // Search across visible columns (formatted text), then sort (server paging: the server did both)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (serverSide || !q) return allRows;
    return allRows.filter((row) => visible.some((column) => {
      const text = column.template ? interpolate(column.template, row) : formatValue(row[column.key], column, t);
      return text.toLowerCase().includes(q);
    }));
  }, [allRows, visible, query, t, serverSide]);

  const sorted = useMemo(() => {
    if (serverSide || !sort) return filtered;
    const factor = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => factor * compareValues(a[sort.key], b[sort.key]));
  }, [filtered, sort, serverSide]);

  const paged = pageSize > 0;
  const total = serverSide ? Math.max(0, Number(totalRows ?? sorted.length) || 0) : sorted.length;
  const pageCount = paged ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const pageRows = serverSide || !paged ? sorted : sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const goToPage = (next) => {
    if (busy || next === currentPage) return;
    setPage(next);
    onPageChange?.({ page: next, pageSize });
    if (serverSide) ask({ page: next });
  };
  const changePageSize = (next) => {
    setPageSize(next);
    setPage(1);
    if (serverSide) ask({ page: 1, pageSize: next });
  };
  const changeQuery = (text) => {
    setQuery(text);
    setPage(1);
    if (!serverSide) return;
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      onSearchChange?.({ query: text.trim() });
      ask({ page: 1, query: text.trim() });
    }, searchDelay);
  };

  // After a failed Submit, show the page holding this table's first error
  const firstErrorKey = Object.keys(errors).find((key) => errors[key] && key.startsWith(`${tableName}.`));
  useEffect(() => {
    if (!firstErrorKey || !paged || serverSide) return;
    const rowPart = firstErrorKey.slice(tableName.length + 1, firstErrorKey.lastIndexOf('.'));
    const index = sorted.findIndex((row) => rowKeyOf(row, rowKey) === rowPart);
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstErrorKey]);

  const toggleSort = (column) => {
    if (column.actions || !(column.sortable ?? sortable) || busy) return;
    const next = sort?.key !== column.key ? { key: column.key, dir: 'asc' }
      : sort.dir === 'asc' ? { key: column.key, dir: 'desc' } : null;
    setSort(next);
    onSortChange?.({ sort: next });
    if (serverSide) { setPage(1); ask({ page: 1, sort: next }); }
  };

  const setSelection = (keys) => {
    actions?.selectRows?.(nodeId, keys);
    const keySet = new Set(keys);
    onSelectionChange?.({ selected: keys, rows: stripRowIds(allRows.filter((row) => keySet.has(rowKeyOf(row, rowKey)))) });
  };
  const single = selectable === 'single';
  const toggleRow = (key) => setSelection(single ? [key] : selectedKeys.has(key) ? [...selectedKeys].filter((k) => k !== key) : [...selectedKeys, key]);
  const pageKeys = pageRows.map((row) => rowKeyOf(row, rowKey));
  const allOnPageSelected = pageKeys.length > 0 && pageKeys.every((key) => selectedKeys.has(key));
  const someOnPageSelected = pageKeys.some((key) => selectedKeys.has(key));
  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someOnPageSelected && !allOnPageSelected;
  });
  const toggleAllOnPage = () => setSelection(allOnPageSelected
    ? [...selectedKeys].filter((key) => !pageKeys.includes(key))
    : [...new Set([...selectedKeys, ...pageKeys])]);

  const changeCell = (row, column, value, event) => {
    const key = rowKeyOf(row, rowKey);
    const fieldName = cellFieldName(tableName, key, column.key);
    actions?.updateRow?.(nodeId, key, { [column.key]: value });
    formContext?.onFieldChange?.(event, fieldName, value); // clears the cell's error
    onCellChange?.({ row: stripRowIds([{ ...row, [column.key]: value }])[0], rowKey: key, column: column.key, value });
  };

  // Schema buttons: "onClick": "editOrder()" runs a form action as fn(event, context)
  const rowContext = (row) => ({ table: nodeId, name: tableName, row: stripRowIds([row])[0], rowKey: rowKeyOf(row, rowKey) });
  const selectionContext = () => {
    const rowsSelected = allRows.filter((row) => selectedKeys.has(rowKeyOf(row, rowKey)));
    return { table: nodeId, name: tableName, selected: [...selectedKeys], rows: stripRowIds(rowsSelected) };
  };
  const actionButton = (item, i, getContext, disabled) => (
    <Button key={item.name ?? i} size="sm" variant={item.variant || 'outline-primary'} className={item.className}
      title={item.title} aria-label={item.title} disabled={disabled}
      onClick={(event) => runAction(actions, item.onClick, event, getContext())}>
      {item.text}
    </Button>
  );
  const rowActions = (column, row) => (
    <div className="rc-d-inline-flex rc-flex-wrap rc-gap-1">
      {column.actions
        .filter((item) => !item.hiddenWhen || !matchesRule(item.hiddenWhen, row))
        .map((item, i) => actionButton(item, i, () => rowContext(row), item.disabledWhen && matchesRule(item.disabledWhen, row)))}
    </div>
  );

  const renderCell = (column, row) => {
    if (column.actions) return rowActions(column, row);
    const value = row[column.key];
    if (column.editor) {
      const key = rowKeyOf(row, rowKey);
      const fieldName = cellFieldName(tableName, key, column.key);
      return (
        <CellEditor editor={column.editor} value={value} fieldName={fieldName} error={errors[fieldName]}
          label={`${column.title ?? column.key}`} onChange={(next) => changeCell(row, column, next)} />
      );
    }
    if (typeof column.render === 'function') return column.render(value, stripRowIds([row])[0]);
    const text = column.template ? interpolate(column.template, row) : formatValue(value, column, t);
    if (column.badge && text !== '') return <BsBadge bg={column.badge[value] ?? column.badge.default ?? 'secondary'}>{text}</BsBadge>;
    if (column.link && text !== '') return <a href={interpolate(column.link, row)} target={column.linkTarget}>{text}</a>;
    return text;
  };

  const cellClass = (column) => [
    alignClass[column.align],
    column.hideBelow && BREAKPOINTS.includes(column.hideBelow) && `rc-d-none rc-d-${column.hideBelow}-table-cell`,
    column.cellClassName,
  ].filter(Boolean).join(' ') || undefined;

  // the row last clicked (tables without selection, with onRowClick)
  const [clickedKey, setClickedKey] = useState(null);
  // ---------------------------------------------------------------- colors / hover
  // Hovered cell { row, col }; only tracked when a hover look is set
  const trackHover = Boolean(hoverRow || hoverColumn || hoverCell);
  const [hovered, setHovered] = useState({ row: null, col: null });
  const hoverAt = (row, col) => setHovered((prev) => (prev.row === row && prev.col === col ? prev : { row, col }));
  const clearHover = () => hoverAt(null, null);

  // Looks shared by every cell of a row (row data, rowRules, selection, row hover)
  const rowLooks = (row, key) => [
    row._variant ? { variant: row._variant, style: {} } : null,
    lookFrom(row._look),
    ...ruleLooks(rowRules, row),
    selectedKeys.has(key) || (clickedKey !== null && clickedKey === key && !selectable) ? lookFrom(selectedLook) : null,
  ];
  const rowHoverLook = (key) => (hoverRow && hovered.row === key ? lookFrom(hoverRow) : null);

  const bodyCellProps = (row, key, column, baseClass) => lookProps(mergeLooks([
    ...rowLooks(row, key),
    lookFrom(column.look ?? (column.variant ? { variant: column.variant } : null)),
    ...ruleLooks(column.cellRules, row, column.key),
    rowHoverLook(key),
    hoverColumn && hovered.col === column.key ? lookFrom(hoverColumn) : null,
    hoverCell && hovered.row === key && hovered.col === column.key ? lookFrom(hoverCell) : null,
  ]), baseClass);

  // Selection / remove cells follow the row's colors
  const rowOnlyCellProps = (row, key, baseClass) => lookProps(mergeLooks([...rowLooks(row, key), rowHoverLook(key)]), baseClass);

  const headerCellProps = (column, baseClass) => lookProps(mergeLooks([
    lookFrom(column.headerLook ?? (column.headerVariant ? { variant: column.headerVariant } : null)),
    hoverColumn && hovered.col === column.key ? lookFrom(hoverColumn) : null,
  ]), baseClass);

  const headerRows = buildHeaderRows(columns, hidden);
  const spans = computeSpans(pageRows, visible);
  const totals = visible.map((column) => (column.total ? aggregate(column.total, sorted, column.key) : null));
  const hasTotals = visible.some((column) => column.total);
  const leadCols = selectable ? 1 : 0;

  const onRowClickHandler = (row, event) => {
    if (event.target.closest('input, select, textarea, button, a, label')) return;
    // a table without selection: the clicked row stays highlighted (highlightClicked: false turns it off)
    if (!selectable && highlightClicked && onRowClick) setClickedKey(rowKeyOf(row, rowKey));
    if (single) toggleRow(rowKeyOf(row, rowKey)); // one row at a time: clicking it picks it
    if (!onRowClick) return;
    onRowClick({ row: stripRowIds([row])[0], rowKey: rowKeyOf(row, rowKey), nativeEvent: event });
  };

  const removeButton = (row) => (
    <Button size="sm" variant="outline-danger" aria-label={t('table.removeRow')}
      onClick={() => actions?.removeRow?.(nodeId, rowKeyOf(row, rowKey))}>
      {t('table.remove')}
    </Button>
  );

  // ---------------------------------------------------------------- toolbar
  const showToolbar = title || searchable || columnToggle || addable || exportable || (selectable && removable)
    || toolbarActions?.length || canReset;
  const toolbar = showToolbar && (
    <div className="rc-d-flex rc-flex-wrap rc-gap-2 rc-align-items-center rc-mb-2">
      {title ? <h6 className="rc-mb-0 rc-me-auto">{title}</h6> : <div className="rc-me-auto" />}
      {searchable && (
        <Form.Control size="sm" type="search" value={query} style={{ maxWidth: 220 }}
          placeholder={searchPlaceholder || t('table.search')} aria-label={searchPlaceholder || t('table.search')}
          onChange={(e) => changeQuery(e.target.value)} />
      )}
      {columnToggle && (
        <Dropdown autoClose="outside">
          <Dropdown.Toggle size="sm" variant="outline-secondary" id={`${nodeId}-columns`}>{t('table.columns')}</Dropdown.Toggle>
          <Dropdown.Menu>
            {leaves.map((column) => (
              <Dropdown.ItemText key={column.key}>
                <Form.Check type="checkbox" id={`${nodeId}-col-${column.key}`} label={column.title ?? column.key}
                  checked={!hidden.has(column.key)} onChange={() => actions?.toggleColumn?.(nodeId, column.key)} />
              </Dropdown.ItemText>
            ))}
          </Dropdown.Menu>
        </Dropdown>
      )}
      {selectable && removable && selectedKeys.size > 0 && (
        <Button size="sm" variant="outline-danger" onClick={() => actions?.removeSelectedRows?.(nodeId)}>
          {t('table.deleteSelected', { count: selectedKeys.size })}
        </Button>
      )}
      {toolbarButtons(toolbarActions, actions, selectionContext, { hasSelection: selectedKeys.size > 0 })}
      {canReset && (
        <Button size="sm" variant="outline-secondary" title={t('table.resetViewTitle')} onClick={resetView} disabled={busy}>
          {t('table.resetView')}
        </Button>
      )}
      {exportable && (
        <Button size="sm" variant="outline-secondary"
          onClick={() => downloadCsv(exportFileName || `${tableName}.csv`, visible.filter((c) => !c.actions), stripRowIds(sorted))}>
          {t('table.export')}
        </Button>
      )}
      {addable && (
        <Button size="sm" variant="outline-success" onClick={() => actions?.addRow?.(nodeId)}>
          {addLabel || t('table.addRow')}
        </Button>
      )}
    </div>
  );

  // ---------------------------------------------------------------- table view
  const tableView = (
    // The table's own row hover is turned off when hoverRow sets a custom hover color
    <Table striped={striped} bordered={bordered} hover={hover && !hoverRow} size={size} variant={variant}
      responsive={stickyHeader ? false : responsive} className="rc-align-middle rc-mb-2">
      {caption && <caption>{caption}</caption>}
      <thead onMouseLeave={trackHover ? clearHover : undefined}>
        {headerRows.map((cells, level) => (
          <tr key={level}>
            {level === 0 && selectable && (
              <th rowSpan={headerRows.length} style={{ width: 40 }} className={stickyHeader ? 'rc-position-sticky rc-top-0 rc-bg-body' : undefined}>
                {!single && <Form.Check type="checkbox" ref={selectAllRef} aria-label={t('table.selectAll')}
                  checked={allOnPageSelected} onChange={toggleAllOnPage} />}
              </th>
            )}
            {cells.map(({ column, colSpan, rowSpan, group }) => {
              const canSort = !group && !column.actions && (column.sortable ?? sortable);
              // (group headers have no key, so compare only when a sort is active)
              const dir = sort && !group && sort.key === column.key ? sort.dir : null;
              const look = headerCellProps(group ? {} : column,
                [group ? 'rc-text-center' : cellClass(column), stickyHeader && 'rc-position-sticky rc-top-0 rc-bg-body', column.headerClassName]
                  .filter(Boolean).join(' '));
              return (
                <th key={column.key ?? column.title} colSpan={colSpan > 1 ? colSpan : undefined} rowSpan={rowSpan > 1 ? rowSpan : undefined}
                  className={look.className}
                  style={{ width: column.width, cursor: canSort ? 'pointer' : undefined, zIndex: stickyHeader ? 1 : undefined, ...look.style }}
                  aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onMouseEnter={trackHover && !group ? () => hoverAt(null, column.key) : undefined}
                  onClick={canSort ? () => toggleSort(column) : undefined}>
                  {column.title ?? column.key}
                  {canSort && <span className="rc-ms-1 rc-text-muted rc-small" aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>}
                </th>
              );
            })}
            {level === 0 && removable && (
              <th rowSpan={headerRows.length} className={stickyHeader ? 'rc-position-sticky rc-top-0 rc-bg-body' : undefined}>
                <span className="rc-visually-hidden">{t('table.remove')}</span>
              </th>
            )}
          </tr>
        ))}
      </thead>
      <tbody onMouseLeave={trackHover ? clearHover : undefined}>
        {pageRows.length === 0 && (
          <tr>
            <td colSpan={visible.length + leadCols + (removable ? 1 : 0)} className="rc-text-center rc-text-muted rc-py-3">
              {emptyText || t('table.empty')}
            </td>
          </tr>
        )}
        {pageRows.map((row, r) => {
          const key = rowKeyOf(row, rowKey);
          return (
            <tr key={key} data-row-key={key}
              style={onRowClick ? { cursor: 'pointer' } : undefined} onClick={(e) => onRowClickHandler(row, e)}>
              {selectable && (
                <td {...rowOnlyCellProps(row, key)} onMouseEnter={trackHover ? () => hoverAt(key, null) : undefined}>
                  <Form.Check type={single ? 'radio' : 'checkbox'} name={single ? `${nodeId}-pick` : undefined} aria-label={t('table.selectRow')} checked={selectedKeys.has(key)} onChange={() => toggleRow(key)} />
                </td>
              )}
              {visible.map((column, c) => {
                const span = spans[r][c];
                if (!span) return null;
                return (
                  <td key={column.key} data-column={column.key} {...bodyCellProps(row, key, column, cellClass(column))}
                    rowSpan={span.rowSpan > 1 ? span.rowSpan : undefined} colSpan={span.colSpan > 1 ? span.colSpan : undefined}
                    onMouseEnter={trackHover ? () => hoverAt(key, column.key) : undefined}>
                    {renderCell(column, row)}
                  </td>
                );
              })}
              {removable && (
                <td {...rowOnlyCellProps(row, key, 'rc-text-end')} onMouseEnter={trackHover ? () => hoverAt(key, null) : undefined}>
                  {removeButton(row)}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
      {hasTotals && pageRows.length > 0 && (
        <tfoot>
          <tr className="rc-fw-semibold">
            {selectable && <td />}
            {visible.map((column, c) => (
              <td key={column.key} className={cellClass(column)}>
                {totals[c] !== null ? formatValue(totals[c], { ...column, format: column.total === 'count' ? undefined : column.format }, t)
                  : (c === 0 ? (totalLabel || t('table.total')) : '')}
              </td>
            ))}
            {removable && <td />}
          </tr>
        </tfoot>
      )}
    </Table>
  );

  // ---------------------------------------------------------------- card view (small screens)
  const stackAt = BREAKPOINTS.includes(stackBelow) ? stackBelow : null;
  const cardView = stackAt && (
    <div className={`rc-d-${stackAt}-none`}>
      {pageRows.length === 0 && <p className="rc-text-center rc-text-muted rc-py-3">{emptyText || t('table.empty')}</p>}
      {pageRows.map((row) => {
        const key = rowKeyOf(row, rowKey);
        return (
          <BsCard key={key} className={`rc-mb-2 ${selectedKeys.has(key) ? 'rc-border-primary' : ''}`} onClick={(e) => onRowClickHandler(row, e)}>
            <BsCard.Body className="rc-p-2">
              {selectable && (
                <Form.Check type={single ? 'radio' : 'checkbox'} name={single ? `${nodeId}-pick` : undefined} className="rc-mb-1" label={t('table.selectRow')} id={`${nodeId}-card-${key}`}
                  checked={selectedKeys.has(key)} onChange={() => toggleRow(key)} />
              )}
              {visible.filter((column) => !column.hideInCards).map((column) => (
                <div key={column.key} className="rc-d-flex rc-justify-content-between rc-align-items-center rc-gap-3 rc-py-1 rc-border-bottom">
                  <span className="rc-text-muted rc-small">{column.title ?? column.key}</span>
                  <span className="rc-text-end">{renderCell(column, row)}</span>
                </div>
              ))}
              {removable && <div className="rc-text-end rc-pt-2">{removeButton(row)}</div>}
            </BsCard.Body>
          </BsCard>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------- pagination
  const from = total ? (serverSide ? (currentPage - 1) * pageSize + (pageRows.length ? 1 : 0) : (currentPage - 1) * (paged ? pageSize : total) + 1) : 0;
  const to = serverSide ? (currentPage - 1) * pageSize + pageRows.length : paged ? Math.min(currentPage * pageSize, total) : total;
  const pagination = paged && (pageCount > 1 || pageSizeOptions) && (
    <div className="rc-d-flex rc-flex-wrap rc-justify-content-between rc-align-items-center rc-gap-2">
      <small className="rc-text-muted">
        {busy ? <><Spinner animation="border" size="sm" className="rc-me-1" />{t('table.loading')}</> : t('table.showing', { from, to, total })}
      </small>
      <div className="rc-d-flex rc-align-items-center rc-gap-2">
        {pageSizeOptions && (
          <Form.Select size="sm" value={pageSize} style={{ width: 'auto' }} aria-label={t('table.rowsPerPage')} disabled={busy}
            onChange={(e) => changePageSize(Number(e.target.value))}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Form.Select>
        )}
        {pageCount > 1 && (
          <Pagination size="sm" className="rc-mb-0">
            <Pagination.First disabled={busy || currentPage === 1} onClick={() => goToPage(1)} />
            <Pagination.Prev disabled={busy || currentPage === 1} onClick={() => goToPage(currentPage - 1)} />
            {pageNumbers(currentPage, pageCount).map((p, i) => (p === '…'
              ? <Pagination.Ellipsis key={`e${i}`} disabled />
              : <Pagination.Item key={p} active={p === currentPage} disabled={busy && p !== currentPage} onClick={() => goToPage(p)}>{p}</Pagination.Item>))}
            <Pagination.Next disabled={busy || currentPage === pageCount} onClick={() => goToPage(currentPage + 1)} />
            <Pagination.Last disabled={busy || currentPage === pageCount} onClick={() => goToPage(pageCount)} />
          </Pagination>
        )}
      </div>
    </div>
  );

  return (
    <div data-rcube-table={nodeId} className={`rc-mb-3 ${className}`.trim()} style={style}>
      <style>{TABLE_CSS}</style>
      {toolbar}
      <div className="rc-position-relative" aria-busy={busy || undefined}>
        <div className={stackAt ? `rc-d-none rc-d-${stackAt}-block` : undefined}
          style={stickyHeader ? { maxHeight: maxHeight || 400, overflow: 'auto' } : undefined}>
          {tableView}
        </div>
        {cardView}
        {/* server paging: the previous page stays, dimmed, under a spinner until the next one arrives */}
        {busy && (
          <div className="rc-position-absolute rc-top-0 rc-start-0 rc-w-100 rc-h-100 rc-d-flex rc-align-items-start rc-justify-content-center rc-pt-5"
            style={{ background: 'rgba(var(--rc-body-bg-rgb), .6)', zIndex: 2 }} role="status">
            <Spinner animation="border" size="sm" className="rc-me-2" /><span>{t('table.loading')}</span>
          </div>
        )}
      </div>
      {pagination}
    </div>
  );
};
