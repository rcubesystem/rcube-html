// Pure helpers for DataTable, shared by the component (table.js) and the form actions (form.js)

// Registry names of the table component
export const TABLE_TYPES = new Set(['DataTable', 'DynamicTable']);

// Internal row id, added to rows that don't have one; stripped from getRows / submitted entries
export const ROW_ID = '__id';

let rowCounter = 0;
export const newRowId = () => `n${Date.now().toString(36)}${(rowCounter += 1)}`;

// Give every row a stable internal id (index-based for rows from the schema, so ids stay
// the same between the component and the actions until rows are added / removed)
export const normalizeRows = (rows = []) => (rows || []).map((row, index) => (
  row && row[ROW_ID] !== undefined ? row : { ...row, [ROW_ID]: `r${index}` }
));

export const stripRowIds = (rows = []) => rows.map(({ [ROW_ID]: _id, ...row }) => row);

// Row identity: the schema's rowKey column if set, otherwise the internal id
export const rowKeyOf = (row, rowKey) => String(rowKey ? row[rowKey] : row[ROW_ID]);

// Leaf columns (header groups have "children" columns)
export const leafColumns = (columns = []) => columns.flatMap((column) => (
  column.children?.length ? leafColumns(column.children) : [column]
));

export const removeColumnByKey = (columns = [], key) => columns
  .filter((column) => column.key !== key)
  .map((column) => (column.children ? { ...column, children: removeColumnByKey(column.children, key) } : column))
  .filter((column) => !column.children || column.children.length);

// Merge a patch into the column with this key (anywhere in header groups)
export const updateColumnByKey = (columns = [], key, patch = {}) => columns.map((column) => {
  if (column.key === key) return { ...column, ...patch };
  return column.children ? { ...column, children: updateColumnByKey(column.children, key, patch) } : column;
});

// Hidden leaf column keys: runtime list, or columns marked "hidden" in the schema
export const hiddenColumnsOf = (props = {}) => props.hiddenColumns
  ?? leafColumns(props.columns).filter((column) => column.hidden).map((column) => column.key);

// Error / input name for an editable cell: "<tableName>.<rowKey>.<columnKey>"
export const cellFieldName = (tableName, rowKey, columnKey) => `${tableName}.${rowKey}.${columnKey}`;

// New row with each column's defaultValue (checkbox editors default to false)
export const emptyRowFor = (columns = []) => Object.fromEntries(leafColumns(columns).map((column) => [
  column.key,
  column.defaultValue ?? (column.editor?.type === 'checkbox' ? false : ''),
]));

/**
 * Validate one editable cell value against its column's editor rules:
 * required, pattern, min / max (numbers), allowedValues — with optional *Message overrides.
 * t: the form's translator for default messages.
 */
export const validateCellValue = (raw, rules = {}, t) => {
  const value = typeof raw === 'string' ? raw.trim() : raw;
  const isEmpty = value === undefined || value === null || value === '' || value === false
    || (Array.isArray(value) && value.length === 0);

  if (rules.required && isEmpty) {
    return rules.requiredMessage || (rules.type === 'checkbox' ? t('validation.requiredCheckbox') : t('validation.required'));
  }
  if (isEmpty) return '';

  const text = String(value);
  if (rules.pattern && !new RegExp(`^(?:${rules.pattern})$`).test(text)) {
    return rules.patternMessage || t('validation.pattern');
  }

  const hasMin = rules.min !== undefined && rules.min !== '';
  const hasMax = rules.max !== undefined && rules.max !== '';
  if (rules.type === 'number' || hasMin || hasMax) {
    const number = Number(text);
    if (Number.isNaN(number)) return rules.numberMessage || t('validation.number');
    const min = Number(rules.min);
    const max = Number(rules.max);
    if ((hasMin && number < min) || (hasMax && number > max)) {
      return rules.rangeMessage
        || (hasMin && hasMax ? t('validation.numberRange', { min, max })
          : hasMin ? t('validation.numberMin', { min })
            : t('validation.numberMax', { max }));
    }
  }

  if (rules.allowedValues?.length) {
    const isAllowed = rules.allowedValues.some((allowed) => String(allowed) === text || Number(allowed) === Number(text));
    if (!isAllowed) return rules.allowedValuesMessage || t('validation.allowedValues', { values: rules.allowedValues.join(', ') });
  }
  return '';
};

// Footer aggregate over a column: sum / avg / min / max / count
export const aggregate = (kind, rows, key) => {
  if (kind === 'count') return rows.filter((row) => row[key] !== undefined && row[key] !== null && row[key] !== '').length;
  // Empty cells are skipped (Number('') would count them as 0)
  const numbers = rows
    .filter((row) => row[key] !== undefined && row[key] !== null && row[key] !== '')
    .map((row) => Number(row[key]))
    .filter((n) => !Number.isNaN(n));
  if (!numbers.length) return null;
  if (kind === 'sum') return numbers.reduce((a, b) => a + b, 0);
  if (kind === 'avg') return numbers.reduce((a, b) => a + b, 0) / numbers.length;
  if (kind === 'min') return Math.min(...numbers);
  if (kind === 'max') return Math.max(...numbers);
  return null;
};

// "{firstName} {lastName}" -> values from the row
export const interpolate = (template, row) => String(template).replace(/\{(\w+)\}/g, (_, key) => (row[key] ?? ''));
