import { useEffect, useMemo, useRef, useState } from "react";
import { Badge as BsBadge, Button, Card as BsCard, Dropdown, Form, Pagination, Table } from "react-bootstrap";
import { InputField, SelectField, runAction } from "./form";
import { useTranslator } from "./i18n";
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
 *     "addable": true, "exportable": true, "columnToggle": true, "stackBelow": "md" } }
 *
 * Schema buttons run form actions by name, called as fn(event, context):
 *   column  { "key": "actions", "actions": [ { "text": "Edit", "onClick": "editOrder()" } ] }  -> { table, name, row, rowKey }
 *   table   "toolbarActions": [ { "text": "Approve", "onClick": "approve()", "needsSelection": true } ] -> { table, name, selected, rows }
 *
 * Rows / columns / selection / hidden columns changed at runtime live in the form's element state
 * (actions.addRow, removeRow, updateRow, setRows, addColumn, removeColumn, toggleColumn, selectRows, ...).
 */

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', 'xxl'];
const alignClass = { start: 'text-start', center: 'text-center', end: 'text-end' };

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
 *   variant    - Bootstrap table color: primary, secondary, success, danger, warning, info, light, dark, active
 *   background - any CSS color (drawn through Bootstrap's --bs-table-bg-state, so it shows over stripes / hover)
 *   color      - text color (--bs-table-color-state)
 * Used by row data (_variant / _look), rowRules, column look / headerLook / cellRules, hoverRow /
 * hoverColumn / hoverCell and selectedLook. When several apply, later ones win:
 * row → column → cell rules → selected → hover row → hover column → hover cell.
 */
const lookFrom = (look) => {
  if (!look) return null;
  const { variant, background, color, className, style } = look;
  return {
    variant,
    className,
    style: {
      ...(background && { '--bs-table-bg-state': background }),
      ...(color && { '--bs-table-color-state': color }),
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
  className: [baseClass, merged.variant && `table-${merged.variant}`, ...merged.classNames].filter(Boolean).join(' ') || undefined,
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
  const common = { name: fieldName, error, className: 'mb-0', 'aria-label': label, required };
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
  rowRules, hoverRow, hoverColumn, hoverCell, selectedLook = { variant: 'active' }, toolbarActions,
  className = '', style,
  onRowClick, onSelectionChange, onCellChange, onPageChange, onSortChange,
}) => {
  const t = useTranslator();
  const tableName = name || nodeId;
  const errors = formContext?.errors || {};

  const allRows = useMemo(() => normalizeRows(rows), [rows]);
  const leaves = useMemo(() => leafColumns(columns), [columns]);
  const hidden = useMemo(() => new Set(hiddenColumnsOf({ columns, hiddenColumns })), [columns, hiddenColumns]);
  const visible = leaves.filter((column) => !hidden.has(column.key));
  const selectedKeys = useMemo(() => new Set((selected || []).map(String)), [selected]);

  const [sort, setSort] = useState(null); // { key, dir: 'asc' | 'desc' }
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  // Search across visible columns (formatted text), then sort
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((row) => visible.some((column) => {
      const text = column.template ? interpolate(column.template, row) : formatValue(row[column.key], column, t);
      return text.toLowerCase().includes(q);
    }));
  }, [allRows, visible, query, t]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const factor = sort.dir === 'desc' ? -1 : 1;
    return [...filtered].sort((a, b) => factor * compareValues(a[sort.key], b[sort.key]));
  }, [filtered, sort]);

  const paged = pageSize > 0;
  const pageCount = paged ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const pageRows = paged ? sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize) : sorted;

  const goToPage = (next) => {
    setPage(next);
    onPageChange?.({ page: next, pageSize });
  };

  // After a failed Submit, show the page holding this table's first error
  const firstErrorKey = Object.keys(errors).find((key) => errors[key] && key.startsWith(`${tableName}.`));
  useEffect(() => {
    if (!firstErrorKey || !paged) return;
    const rowPart = firstErrorKey.slice(tableName.length + 1, firstErrorKey.lastIndexOf('.'));
    const index = sorted.findIndex((row) => rowKeyOf(row, rowKey) === rowPart);
    if (index >= 0) setPage(Math.floor(index / pageSize) + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstErrorKey]);

  const toggleSort = (column) => {
    if (column.actions || !(column.sortable ?? sortable)) return;
    const next = sort?.key !== column.key ? { key: column.key, dir: 'asc' }
      : sort.dir === 'asc' ? { key: column.key, dir: 'desc' } : null;
    setSort(next);
    onSortChange?.({ sort: next });
  };

  const setSelection = (keys) => {
    actions?.selectRows?.(nodeId, keys);
    const keySet = new Set(keys);
    onSelectionChange?.({ selected: keys, rows: stripRowIds(allRows.filter((row) => keySet.has(rowKeyOf(row, rowKey)))) });
  };
  const toggleRow = (key) => setSelection(selectedKeys.has(key) ? [...selectedKeys].filter((k) => k !== key) : [...selectedKeys, key]);
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
    <div className="d-inline-flex flex-wrap gap-1">
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
    column.hideBelow && BREAKPOINTS.includes(column.hideBelow) && `d-none d-${column.hideBelow}-table-cell`,
    column.cellClassName,
  ].filter(Boolean).join(' ') || undefined;

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
    selectedKeys.has(key) ? lookFrom(selectedLook) : null,
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
    if (!onRowClick || event.target.closest('input, select, textarea, button, a, label')) return;
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
    || toolbarActions?.length;
  const toolbar = showToolbar && (
    <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
      {title ? <h6 className="mb-0 me-auto">{title}</h6> : <div className="me-auto" />}
      {searchable && (
        <Form.Control size="sm" type="search" value={query} style={{ maxWidth: 220 }}
          placeholder={searchPlaceholder || t('table.search')} aria-label={searchPlaceholder || t('table.search')}
          onChange={(e) => { setQuery(e.target.value); setPage(1); }} />
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
      {toolbarActions?.map((item, i) => actionButton(item, i, selectionContext, item.needsSelection && selectedKeys.size === 0))}
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
    // Bootstrap's own row hover is turned off when hoverRow sets a custom hover color
    <Table striped={striped} bordered={bordered} hover={hover && !hoverRow} size={size} variant={variant}
      responsive={stickyHeader ? false : responsive} className="align-middle mb-2">
      {caption && <caption>{caption}</caption>}
      <thead onMouseLeave={trackHover ? clearHover : undefined}>
        {headerRows.map((cells, level) => (
          <tr key={level}>
            {level === 0 && selectable && (
              <th rowSpan={headerRows.length} style={{ width: 40 }} className={stickyHeader ? 'position-sticky top-0 bg-body' : undefined}>
                <Form.Check type="checkbox" ref={selectAllRef} aria-label={t('table.selectAll')}
                  checked={allOnPageSelected} onChange={toggleAllOnPage} />
              </th>
            )}
            {cells.map(({ column, colSpan, rowSpan, group }) => {
              const canSort = !group && !column.actions && (column.sortable ?? sortable);
              // (group headers have no key, so compare only when a sort is active)
              const dir = sort && !group && sort.key === column.key ? sort.dir : null;
              const look = headerCellProps(group ? {} : column,
                [group ? 'text-center' : cellClass(column), stickyHeader && 'position-sticky top-0 bg-body', column.headerClassName]
                  .filter(Boolean).join(' '));
              return (
                <th key={column.key ?? column.title} colSpan={colSpan > 1 ? colSpan : undefined} rowSpan={rowSpan > 1 ? rowSpan : undefined}
                  className={look.className}
                  style={{ width: column.width, cursor: canSort ? 'pointer' : undefined, zIndex: stickyHeader ? 1 : undefined, ...look.style }}
                  aria-sort={dir ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  onMouseEnter={trackHover && !group ? () => hoverAt(null, column.key) : undefined}
                  onClick={canSort ? () => toggleSort(column) : undefined}>
                  {column.title ?? column.key}
                  {canSort && <span className="ms-1 text-muted small" aria-hidden="true">{dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕'}</span>}
                </th>
              );
            })}
            {level === 0 && removable && (
              <th rowSpan={headerRows.length} className={stickyHeader ? 'position-sticky top-0 bg-body' : undefined}>
                <span className="visually-hidden">{t('table.remove')}</span>
              </th>
            )}
          </tr>
        ))}
      </thead>
      <tbody onMouseLeave={trackHover ? clearHover : undefined}>
        {pageRows.length === 0 && (
          <tr>
            <td colSpan={visible.length + leadCols + (removable ? 1 : 0)} className="text-center text-muted py-3">
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
                  <Form.Check type="checkbox" aria-label={t('table.selectRow')} checked={selectedKeys.has(key)} onChange={() => toggleRow(key)} />
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
                <td {...rowOnlyCellProps(row, key, 'text-end')} onMouseEnter={trackHover ? () => hoverAt(key, null) : undefined}>
                  {removeButton(row)}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
      {hasTotals && pageRows.length > 0 && (
        <tfoot>
          <tr className="fw-semibold">
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
    <div className={`d-${stackAt}-none`}>
      {pageRows.length === 0 && <p className="text-center text-muted py-3">{emptyText || t('table.empty')}</p>}
      {pageRows.map((row) => {
        const key = rowKeyOf(row, rowKey);
        return (
          <BsCard key={key} className={`mb-2 ${selectedKeys.has(key) ? 'border-primary' : ''}`} onClick={(e) => onRowClickHandler(row, e)}>
            <BsCard.Body className="p-2">
              {selectable && (
                <Form.Check type="checkbox" className="mb-1" label={t('table.selectRow')} id={`${nodeId}-card-${key}`}
                  checked={selectedKeys.has(key)} onChange={() => toggleRow(key)} />
              )}
              {visible.filter((column) => !column.hideInCards).map((column) => (
                <div key={column.key} className="d-flex justify-content-between align-items-center gap-3 py-1 border-bottom">
                  <span className="text-muted small">{column.title ?? column.key}</span>
                  <span className="text-end">{renderCell(column, row)}</span>
                </div>
              ))}
              {removable && <div className="text-end pt-2">{removeButton(row)}</div>}
            </BsCard.Body>
          </BsCard>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------- pagination
  const from = sorted.length ? (currentPage - 1) * (paged ? pageSize : sorted.length) + 1 : 0;
  const to = paged ? Math.min(currentPage * pageSize, sorted.length) : sorted.length;
  const pagination = paged && (pageCount > 1 || pageSizeOptions) && (
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <small className="text-muted">{t('table.showing', { from, to, total: sorted.length })}</small>
      <div className="d-flex align-items-center gap-2">
        {pageSizeOptions && (
          <Form.Select size="sm" value={pageSize} style={{ width: 'auto' }} aria-label={t('table.rowsPerPage')}
            onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
            {pageSizeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </Form.Select>
        )}
        {pageCount > 1 && (
          <Pagination size="sm" className="mb-0">
            <Pagination.First disabled={currentPage === 1} onClick={() => goToPage(1)} />
            <Pagination.Prev disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} />
            {pageNumbers(currentPage, pageCount).map((p, i) => (p === '…'
              ? <Pagination.Ellipsis key={`e${i}`} disabled />
              : <Pagination.Item key={p} active={p === currentPage} onClick={() => goToPage(p)}>{p}</Pagination.Item>))}
            <Pagination.Next disabled={currentPage === pageCount} onClick={() => goToPage(currentPage + 1)} />
            <Pagination.Last disabled={currentPage === pageCount} onClick={() => goToPage(pageCount)} />
          </Pagination>
        )}
      </div>
    </div>
  );

  return (
    <div data-rcube-table={nodeId} className={`mb-3 ${className}`.trim()} style={style}>
      {toolbar}
      <div className={stackAt ? `d-none d-${stackAt}-block` : undefined}
        style={stickyHeader ? { maxHeight: maxHeight || 400, overflow: 'auto' } : undefined}>
        {tableView}
      </div>
      {cardView}
      {pagination}
    </div>
  );
};
