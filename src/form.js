import { forwardRef, useEffect, useRef, useState } from "react";
import { Form, Button } from "react-bootstrap";
import { REVEAL_EVENT } from "./components";
// Translation: each form supplies its translator via context (see i18n.js / useDynamicTag)
import { defaultTranslator, translateProps, useTranslator } from "./i18n";
import {
  TABLE_TYPES, ROW_ID, cellFieldName, emptyRowFor, hiddenColumnsOf, leafColumns, newRowId, normalizeRows,
  removeColumnByKey, rowKeyOf, stripRowIds, updateColumnByKey, validateCellValue,
} from "./tableUtils";
import { dayKey, parseDate, rangeOf, shiftDate, startOfDay } from "./calendarUtils";
import {
  ancestorIds, findTreeNode, initiallyExpanded, insertTreeNode, isBranch, mapTreeNode, moveTreeNode, removeTreeNode, walkTree,
} from "./treeUtils";

// Field wrapper spacing: mb-3 unless the schema's className sets its own margin (e.g. "mb-0" in table cells)
const withSpacing = (className = '') => (/(^|\s)(m|mb|my)-(\d|auto)(\s|$)/.test(className) ? className : `mb-3 ${className}`.trim());

// Label text with a red * when the field is required
const LabelText = ({ label, required }) => (
  <>
    {label}
    {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
  </>
);

const countDigits = (s) => s.replace(/\D/g, '').length;

// "YYYY-MM-DD" -> local Date at midnight (new Date("YYYY-MM-DD") would be UTC and can shift a day)
const parseLocalDate = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  const date = new Date(+m[1], +m[2] - 1, +m[3]);
  return date.getDate() === +m[3] ? date : null; // rejects e.g. 2023-02-30
};

const toDateInputValue = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Date limits from schema props: beforeToday -> latest allowed is yesterday; maxYearsAgo -> earliest allowed
const getDateLimits = ({ beforeToday, maxYearsAgo } = {}) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let maxDate = null;
  let minDate = null;
  if (beforeToday) {
    maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() - 1);
  }
  if (maxYearsAgo) {
    minDate = new Date(today);
    minDate.setFullYear(minDate.getFullYear() - Number(maxYearsAgo));
  }
  return { maxDate, minDate };
};

// Fill a mask like "(###) ###-####" (# = digit) with the digits in value.
// Mask characters are only added up to the last digit, so backspacing works naturally.
export const applyMask = (value, mask) => {
  const digits = value.replace(/\D/g, '');
  let out = '';
  let d = 0;
  for (const ch of mask) {
    if (d >= digits.length) break;
    out += ch === '#' ? digits[d++] : ch;
  }
  return out;
};

// Reformat a masked input in place, keeping the cursor after the same number of digits
const formatMaskedInput = (el, mask, inputType) => {
  let raw = el.value;
  let cursor = el.selectionStart ?? raw.length;

  // Backspace over a mask character (e.g. ")" or "-"): remove the digit before it instead
  if (inputType === 'deleteContentBackward' && countDigits(raw) === countDigits(el.dataset.prev || '')) {
    const before = raw.slice(0, cursor).replace(/\d(\D*)$/, '$1');
    raw = before + raw.slice(cursor);
    cursor = before.length;
  }

  const digitsBeforeCursor = countDigits(raw.slice(0, cursor));
  const formatted = applyMask(raw, mask);

  let pos = 0;
  for (let seen = 0; pos < formatted.length && seen < digitsBeforeCursor; pos++) {
    if (/\d/.test(formatted[pos])) seen++;
  }

  el.value = formatted;
  el.dataset.prev = formatted;
  try { el.setSelectionRange(pos, pos); } catch { /* not supported on every input type */ }
};

/**
 * <input> with Validation Display
 * Handles variants: text, password, number, search, email, url, tel,
 * date, time, datetime-local, month, week, color, checkbox, radio, range, file, hidden, image
 *
 * Uncontrolled unless a `value` prop is passed (use `defaultValue` / refs otherwise).
 */
export const InputField = forwardRef(function InputField(
  // requiredMessage / patternMessage are validation-only schema props, kept off the DOM
  // uppercase / lowercase: schema flags that convert typed text to upper / lower case
  // mask: schema format such as "(###) ###-####" applied while typing (# = digit)
  // beforeToday / maxYearsAgo (+ their messages): date range rules, also applied as the picker's min/max
  // numberMessage / rangeMessage / allowedValues / allowedValuesMessage: number rules (min / max stay on the input)
  { label, type = 'text', className = '', id, name, error, value, onChange, required, requiredMessage, patternMessage, uppercase, lowercase, mask,
    beforeToday, maxYearsAgo, beforeTodayMessage, maxYearsAgoMessage,
    numberMessage, rangeMessage, allowedValues, allowedValuesMessage, ...props },
  ref
) {
  const isCheckboxOrRadio = type === 'checkbox' || type === 'radio';
  const isControlled = value !== undefined;
  const inputId = id || name;

  // Limit the date picker to the same range validateField enforces
  const dateLimitProps = {};
  if (type === 'date') {
    const { maxDate, minDate } = getDateLimits({ beforeToday, maxYearsAgo });
    if (maxDate) dateLimitProps.max = toDateInputValue(maxDate);
    if (minDate) dateLimitProps.min = toDateInputValue(minDate);
  }

  const handleChange = (e) => {
    if (mask) {
      formatMaskedInput(e.target, mask, e.nativeEvent?.inputType);
    } else if (uppercase || lowercase) {
      const el = e.target;
      const { selectionStart, selectionEnd } = el;
      el.value = uppercase ? el.value.toUpperCase() : el.value.toLowerCase();
      // Keep the cursor where the user was typing (not supported on every input type)
      try { el.setSelectionRange(selectionStart, selectionEnd); } catch { /* ignore */ }
    }
    onChange?.(e);
  };

  if (type === 'hidden') return <input ref={ref} type="hidden" name={name} value={value} {...props} />;

  if (isCheckboxOrRadio) {
    // Built from Input + Label so the label can keep its normal color (text-body) when invalid;
    // only the box itself turns red
    return (
      <Form.Check id={inputId} className={withSpacing(className)}>
        <Form.Check.Input
          ref={ref}
          type={type}
          name={name}
          required={required}
          {...(isControlled ? { checked: !!value } : {})}
          onChange={onChange}
          isInvalid={!!error}
          {...props}
        />
        {label && <Form.Check.Label className="text-body"><LabelText label={label} required={required} /></Form.Check.Label>}
        <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
      </Form.Check>
    );
  }

  // Form.Range has no type/isInvalid props; Form.Control handles every other input type
  const isRange = type === 'range';
  const Control = isRange ? Form.Range : Form.Control;

  return (
    <Form.Group controlId={inputId} className={withSpacing(className)}>
      {label && <Form.Label><LabelText label={label} required={required} /></Form.Label>}
      <Control
        ref={ref}
        name={name}
        {...(isRange ? {} : { type, isInvalid: !!error })}
        {...dateLimitProps}
        required={required}
        // Only set value when controlled, otherwise the input becomes read-only
        {...(isControlled ? { value: value ?? '' } : {})}
        onChange={handleChange}
        {...props}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
});

// <textarea> with Validation Display
export const TextareaField = forwardRef(function TextareaField(
  { label, className = '', id, name, error, value, onChange, required, requiredMessage, rows = 4, ...props },
  ref
) {
  return (
    <Form.Group controlId={id || name} className={withSpacing(className)}>
      {label && <Form.Label><LabelText label={label} required={required} /></Form.Label>}
      <Form.Control
        as="textarea"
        ref={ref}
        name={name}
        rows={rows}
        required={required}
        value={value}
        onChange={onChange}
        isInvalid={!!error}
        {...props}
      />
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
});

/**
 * <select> with Validation Display
 * Static options:    "options": ["A", "B"] or [{ label, value }]
 * Dependent options: "optionsFrom": { "field": "state", "map": { [stateValue]: [...options] },
 *                                     "waitingText": "...", "emptyText": "... {value} ..." }
 *   The list follows formValues[field]; changing that field resets this select.
 */
export const SelectField = forwardRef(function SelectField(
  { label, options = [], optionsFrom, formValues, placeholder: placeholderProp, className = '', id, name, error, value, onChange, required, requiredMessage, ...props },
  ref
) {
  const t = useTranslator();
  const placeholder = placeholderProp ?? t('select.placeholder');
  const parentValue = optionsFrom ? formValues?.[optionsFrom.field] : undefined;
  const choices = optionsFrom ? (optionsFrom.map?.[parentValue] || []) : options;
  const noChoices = optionsFrom && choices.length === 0;

  const placeholderText = !optionsFrom ? placeholder
    : !parentValue ? (optionsFrom.waitingText || t('select.waitingForParent'))
      : noChoices ? (optionsFrom.emptyText || t('select.noOptions')).replace('{value}', parentValue)
        : placeholder;

  return (
    <Form.Group controlId={id || name} className={withSpacing(className)}>
      {label && <Form.Label><LabelText label={label} required={required && !noChoices} /></Form.Label>}
      <Form.Select
        // Remount when the parent value changes so the previous choice is cleared
        key={optionsFrom ? `parent-${parentValue || ''}` : undefined}
        ref={ref}
        name={name}
        required={required && !noChoices}
        disabled={noChoices || undefined}
        value={value}
        onChange={onChange}
        isInvalid={!!error}
        {...props}
      >
        <option value="">{placeholderText}</option>
        {choices.map((opt, i) => (
          <option key={i} value={typeof opt === 'string' ? opt : opt.value}>
            {typeof opt === 'string' ? opt : opt.label}
          </option>
        ))}
      </Form.Select>
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
});

/**
 * Radio / checkbox group: one field name, several options.
 * The ref points at the <fieldset>, so fieldRefs holds a single entry for the whole group.
 * options: ["Male", "Female"] or [{ label: "Male", value: "male" }, ...]
 * value (controlled only): a string for radios, an array of strings for checkboxes
 */
const ChoiceGroup = forwardRef(function ChoiceGroup(
  // requiredOptions / requiredOptionsMessage: options that must all be checked (validation-only, kept off the DOM)
  { type, label, options = [], className = '', id, name, error, value, onChange, required, requiredMessage,
    requiredOptions = [], requiredOptionsMessage, inline = true, ...props },
  ref
) {
  const groupId = id || name;
  const isChecked = (optValue) => (type === 'radio' ? value === optValue : Array.isArray(value) && value.includes(optValue));
  return (
    <Form.Group as="fieldset" ref={ref} className={withSpacing(className)} {...props}>
      {label && <Form.Label as="legend" className="fs-6 mb-2"><LabelText label={label} required={required} /></Form.Label>}
      {options.map((opt) => {
        const optValue = typeof opt === 'string' ? opt : opt.value;
        const optLabel = typeof opt === 'string' ? opt : opt.label;
        return (
          <Form.Check key={optValue} inline={inline} id={`${groupId}-${optValue}`}>
            <Form.Check.Input
              type={type}
              name={name}
              value={optValue}
              // Native required on every checkbox would mean "all must be checked", so radios only
              required={type === 'radio' ? required : undefined}
              {...(value !== undefined ? { checked: isChecked(optValue) } : {})}
              onChange={onChange}
              isInvalid={!!error}
            />
            {/* text-body keeps the option text its normal color when invalid; only the input turns red */}
            <Form.Check.Label className="text-body">
              <LabelText label={optLabel} required={requiredOptions.includes(optValue)} />
            </Form.Check.Label>
          </Form.Check>
        );
      })}
      <Form.Control.Feedback type="invalid" className={error ? 'd-block' : ''}>{error}</Form.Control.Feedback>
    </Form.Group>
  );
});

// Pick exactly one option
export const RadioGroupField = forwardRef(function RadioGroupField(props, ref) {
  return <ChoiceGroup {...props} type="radio" ref={ref} />;
});

// Pick any number of options; "required" means at least one
export const CheckboxGroupField = forwardRef(function CheckboxGroupField(props, ref) {
  return <ChoiceGroup {...props} type="checkbox" ref={ref} />;
});

// Fired on a field element when its value is set in code (setFieldDomValue), so components that
// show the value themselves (SliderField) can update
const FIELD_VALUE_SET_EVENT = 'rcube:valueset';

/**
 * Range slider with its current value shown next to the label.
 * { "type": "SliderField", "id": "age", "props": { "name": "age", "label": "Age", "min": 18, "max": 99,
 *   "step": 1, "defaultValue": 30, "showValue": true, "valueSuffix": " yrs" } }
 * Value is a string like any input (e.g. "30").
 */
export const SliderField = forwardRef(function SliderField(
  { label, className = '', id, name, error, onChange, required, requiredMessage,
    min = 0, max = 100, step = 1, defaultValue, showValue = true, valueSuffix = '', ...props },
  ref
) {
  const inputRef = useRef(null);
  const [display, setDisplay] = useState(defaultValue ?? '');

  // Pass the element to both the local ref and the form's ref
  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  // Show the browser's starting value, and follow values set in code
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return undefined;
    setDisplay(el.value);
    const sync = () => setDisplay(el.value);
    el.addEventListener(FIELD_VALUE_SET_EVENT, sync);
    return () => el.removeEventListener(FIELD_VALUE_SET_EVENT, sync);
  }, []);

  return (
    <Form.Group controlId={id || name} className={withSpacing(className)}>
      {(label || showValue) && (
        <Form.Label className="d-flex justify-content-between w-100">
          <span>{label && <LabelText label={label} required={required} />}</span>
          {showValue && <span className="badge text-bg-secondary">{display}{valueSuffix}</span>}
        </Form.Label>
      )}
      <Form.Range
        ref={setRefs}
        name={name}
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        onChange={(event) => { setDisplay(event.target.value); onChange?.(event); }}
        {...props}
      />
      <Form.Control.Feedback type="invalid" className={error ? 'd-block' : ''}>{error}</Form.Control.Feedback>
    </Form.Group>
  );
});

// Field refs are input/select/textarea elements, or a <fieldset> for radio / checkbox groups
const isChoiceGroup = (el) => el.tagName === 'FIELDSET';
const isCheckboxGroup = (el) => isChoiceGroup(el) && el.querySelector('input')?.type === 'checkbox';

// Current value of a field ref: checked option for radio groups, array of checked options for
// checkbox groups, boolean for a single checkbox, otherwise the input's text
export const getFieldValue = (el) => {
  if (isCheckboxGroup(el)) return Array.from(el.querySelectorAll('input:checked'), (input) => input.value);
  if (isChoiceGroup(el)) return el.querySelector('input:checked')?.value || '';
  if (el.type === 'checkbox') return el.checked;
  return el.value;
};

// Apply the field's schema formatting (mask / upper / lower case) to a value being set in code
const formatForField = (value, fieldProps = {}) => {
  if (typeof value !== 'string') return value;
  if (fieldProps.mask) return applyMask(value, fieldProps.mask);
  if (fieldProps.uppercase) return value.toUpperCase();
  if (fieldProps.lowercase) return value.toLowerCase();
  return value;
};

/**
 * Write a value into a field ref (fields are uncontrolled, so the DOM holds the value).
 * Radio group: option value; checkbox group: array of option values; single checkbox: boolean;
 * select: option value (ignored if that option doesn't exist); others: text.
 */
export const setFieldDomValue = (el, value, fieldProps = {}) => {
  if (!el) return;
  if (isChoiceGroup(el)) {
    const selected = Array.isArray(value) ? value : value ? [value] : [];
    el.querySelectorAll('input').forEach((input) => { input.checked = selected.includes(input.value); });
  } else if (el.type === 'checkbox' || el.type === 'radio') {
    el.checked = !!value;
  } else if (el.tagName === 'SELECT') {
    el.value = Array.from(el.options).some((option) => option.value === value) ? value : '';
  } else {
    el.value = formatForField(value ?? '', fieldProps);
    if (fieldProps.mask) el.dataset.prev = el.value; // keeps mask backspace handling in sync
  }
  el.dispatchEvent?.(new Event(FIELD_VALUE_SET_EVENT));
};

/**
 * Schema nodes nested inside a node: children (rows, columns, containers), items[].children
 * (Tabs, Accordion, Carousel) and footer (Modal).
 */
export const childNodesOf = (node) => [
  ...(node.children || []),
  ...(node.items || []).flatMap((item) => item?.children || []),
  ...(node.footer || []),
];

/**
 * Schema-driven visibility for any node (row, column or field):
 *   "visibleWhen": { "field": "contactPreferences", "includesAny": ["phone", "sms"] }
 * Supported tests: equals (radio / select / text), includesAny, includesAll (checkbox groups).
 * values: { [fieldName]: current value } — an array for checkbox groups.
 */
export const isNodeVisible = (condition, values = {}) => {
  if (!condition) return true;
  const current = values[condition.field];
  const selected = Array.isArray(current) ? current : current ? [current] : [];

  if (condition.equals !== undefined) return current === condition.equals;
  if (condition.includesAny) return condition.includesAny.some((v) => selected.includes(v));
  if (condition.includesAll) return condition.includesAll.every((v) => selected.includes(v));
  return true;
};

/**
 * Deep-copy a schema with a suffix on every id, field name and field reference
 * (visibleWhen.field, props.optionsFrom.field), so a duplicated form keeps its own refs,
 * errors, visibility rules and dependent selects. Nested nodes in children, items[].children
 * and footer are copied too.
 *   cloneSchema(schema, "__2")  ->  "firstName" becomes "firstName__2"
 */
export const cloneSchema = (nodes = [], suffix) => nodes.map((node) => ({
  ...node,
  id: `${node.id}${suffix}`,
  ...(node.visibleWhen && { visibleWhen: { ...node.visibleWhen, field: `${node.visibleWhen.field}${suffix}` } }),
  ...(node.props && { props: {
    ...node.props,
    ...(node.props.name && { name: `${node.props.name}${suffix}` }),
    ...(node.props.optionsFrom && { optionsFrom: { ...node.props.optionsFrom, field: `${node.props.optionsFrom.field}${suffix}` } }),
  } }),
  ...(node.children && { children: cloneSchema(node.children, suffix) }),
  ...(node.items && { items: node.items.map((item) => (item?.children ? { ...item, children: cloneSchema(item.children, suffix) } : item)) }),
  ...(node.footer && { footer: cloneSchema(node.footer, suffix) }),
}));

// Registry names of the components that are form fields (get refs, values and validation).
// A Set so registerComponent(name, Component, { field: true }) can add custom field types.
export const FIELD_TYPES = new Set(['InputField', 'TextareaField', 'SelectField', 'RadioGroupField', 'CheckboxGroupField', 'SliderField', 'FileUploadField', 'FileUpload']);
const fieldTypeOf = (node) => (node.type === 'component' ? node.componentName : node.type);

// Value used for a field that isn't rendered (e.g. hidden by visibleWhen), so every entry has the same keys
const emptyValueFor = (node) => {
  const type = fieldTypeOf(node);
  if (type === 'CheckboxGroupField' || type === 'FileUploadField' || type === 'FileUpload') return [];
  if (type === 'InputField' && node.props?.type === 'checkbox') return false;
  return '';
};

// Copies made by cloneSchema end in "__<copyId>", e.g. "firstName__7"
const COPY_SUFFIX = /__(\d+)$/;

/**
 * Form values as one object per form copy, in page order:
 *   [{ firstName: "JOHN", lastName: "SMITH", ... }, { firstName: "RIYAZ", lastName: "HAMEED", ... }]
 * Copy suffixes are stripped so every entry has the same keys (row / column shape);
 * fields that aren't rendered get an empty value ("" / [] / false).
 * DataTable nodes with a "name" contribute their current rows (array of row objects).
 * nodeState: the form's element state, where runtime table rows live.
 */
export const getFormEntries = (schema = [], fieldRefs, nodeState = {}) => {
  const entries = new Map(); // copyId -> { fieldName: value }
  const add = (fullName, value) => {
    const match = COPY_SUFFIX.exec(fullName);
    const copyId = match ? Number(match[1]) : 1;
    const baseName = match ? fullName.slice(0, match.index) : fullName;
    if (!entries.has(copyId)) entries.set(copyId, {});
    entries.get(copyId)[baseName] = value;
  };
  const walk = (nodes) => nodes.forEach((node) => {
    const nested = childNodesOf(node);
    if (nested.length) return walk(nested);
    const type = fieldTypeOf(node);
    if (TABLE_TYPES.has(type)) {
      if (node.props?.name) add(node.props.name, stripRowIds(normalizeRows(nodeState[node.id]?.props?.rows ?? node.props.rows)));
      return;
    }
    if (!FIELD_TYPES.has(type)) return;
    const fullName = node.props?.name || node.id;
    const el = fieldRefs.current[fullName];
    add(fullName, el ? getFieldValue(el) : emptyValueFor(node));
  });
  walk(schema);
  return [...entries.values()];
};

// First node with this id anywhere in the schema (including inside containers)
export const findNode = (nodes = [], id) => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findNode(childNodesOf(node), id);
    if (found) return found;
  }
  return null;
};

// Every DataTable node in the schema
const tableNodesOf = (nodes = [], result = []) => {
  nodes.forEach((node) => {
    if (TABLE_TYPES.has(fieldTypeOf(node))) result.push(node);
    tableNodesOf(childNodesOf(node), result);
  });
  return result;
};

// A table counts for validation only while it's on the page and not hidden
const isTableRendered = (id) => {
  if (typeof document === 'undefined') return false;
  const el = [...document.querySelectorAll('[data-rcube-table]')].find((e) => e.getAttribute('data-rcube-table') === id);
  return Boolean(el && !el.closest('.d-none'));
};

/**
 * Validate the editable cells of every rendered DataTable against their column editor rules.
 * Returns { errors: { "<table>.<rowKey>.<column>": message }, owners: { errorKey: tableNodeId } }.
 */
export const validateTables = (schema, nodeState = {}, t = defaultTranslator) => {
  const errors = {};
  const owners = {};
  tableNodesOf(schema).forEach((node) => {
    if (!isTableRendered(node.id)) return;
    const props = { ...node.props, ...nodeState[node.id]?.props };
    const tableName = props.name || node.id;
    const editable = leafColumns(props.columns).filter((column) => column.editor);
    if (!editable.length) return;
    normalizeRows(props.rows).forEach((row) => {
      editable.forEach((column) => {
        const message = validateCellValue(row[column.key], translateProps(column.editor, t), t);
        if (!message) return;
        const key = cellFieldName(tableName, rowKeyOf(row, props.rowKey), column.key);
        errors[key] = message;
        owners[key] = node.id;
      });
    });
  });
  return { errors, owners };
};

// Visible element for a field name (table cells may render in both the table and the card view)
const findVisibleByName = (name) => {
  if (typeof document === 'undefined') return null;
  const all = [...document.getElementsByName(name)];
  return all.find((el) => el.offsetParent !== null) || all[0] || null;
};

// Walk the layout schema and collect { [fieldName]: props } for every field node
export const collectFieldProps = (nodes = [], result = {}) => {
  nodes.forEach((node) => {
    const nested = childNodesOf(node);
    if (nested.length) collectFieldProps(nested, result);
    else if (node.props) result[node.props.name || node.id] = node.props;
  });
  return result;
};

// Validate a single field DOM node against its schema props; returns an error message or "".
// t: the form's translator for default messages (library English if omitted)
export const validateField = (el, fieldProps = {}, t = defaultTranslator) => {
  const rawValue = getFieldValue(el);
  const value = typeof rawValue === 'string' ? rawValue.trim() : rawValue;

  // Number inputs report "" for text the browser can't parse (e.g. "1e", "--"); catch it before "required"
  if (el.type === 'number' && el.validity?.badInput) {
    return fieldProps.numberMessage || t('validation.number');
  }

  // Required: driven by the schema's "required" prop (true or "true")
  const isRequired = fieldProps.required === true || fieldProps.required === 'true';

  // File upload: uploads must be finished / retried, then required and minFiles count the files
  if (el.dataset?.rcubeUpload !== undefined) {
    if (el.dataset.uploading) return fieldProps.uploadingMessage || t('upload.stillUploading');
    if (el.dataset.pending) return fieldProps.pendingMessage || t('upload.notUploadedYet');
    if (el.dataset.failed) return fieldProps.failedMessage || t('upload.failedFiles');
    const count = Array.isArray(value) ? value.length : 0;
    if (isRequired && !count) return fieldProps.requiredMessage || t('upload.required');
    if (fieldProps.minFiles && count < fieldProps.minFiles) return fieldProps.minFilesMessage || t('upload.tooFew', { min: fieldProps.minFiles });
    return '';
  }
  const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
  // A select with nothing to pick (e.g. no counties for the chosen state) can't be required
  const hasNoChoices = el.tagName === 'SELECT' && Array.from(el.options).every((option) => !option.value);
  if (isRequired && isEmpty && !hasNoChoices) {
    return fieldProps.requiredMessage
      || (el.type === 'checkbox' ? t('validation.requiredCheckbox')
        : isCheckboxGroup(el) ? t('validation.requiredCheckboxGroup')
          : isChoiceGroup(el) ? t('validation.requiredChoice')
            : t('validation.required'));
  }

  // Checkbox groups: schema "requiredOptions" lists options that must all be checked
  if (Array.isArray(value) && fieldProps.requiredOptions?.length) {
    const missing = fieldProps.requiredOptions.filter((option) => !value.includes(option));
    if (missing.length) {
      return fieldProps.requiredOptionsMessage || t('validation.requiredOptions', { missing: missing.join(', ') });
    }
  }

  // Format: schema "pattern" must match the whole value (same semantics as the HTML pattern attribute)
  if (value && typeof value === 'string' && fieldProps.pattern
      && !new RegExp(`^(?:${fieldProps.pattern})$`).test(value)) {
    return fieldProps.patternMessage || t('validation.pattern');
  }

  // Number range: schema "min" / "max" (either or both)
  const hasMin = fieldProps.min !== undefined && fieldProps.min !== '';
  const hasMax = fieldProps.max !== undefined && fieldProps.max !== '';
  if (value && typeof value === 'string' && el.type === 'number' && (hasMin || hasMax)) {
    const number = Number(value);
    if (Number.isNaN(number)) return fieldProps.numberMessage || t('validation.number');
    const min = Number(fieldProps.min);
    const max = Number(fieldProps.max);
    if ((hasMin && number < min) || (hasMax && number > max)) {
      return fieldProps.rangeMessage
        || (hasMin && hasMax ? t('validation.numberRange', { min, max })
          : hasMin ? t('validation.numberMin', { min })
            : t('validation.numberMax', { max }));
    }
  }

  // Allowed values: schema "allowedValues" lists the only accepted entries (numbers compare by value)
  if (value && typeof value === 'string' && fieldProps.allowedValues?.length) {
    const isAllowed = fieldProps.allowedValues.some((allowed) =>
      String(allowed) === value || (el.type === 'number' && Number(allowed) === Number(value)));
    if (!isAllowed) {
      return fieldProps.allowedValuesMessage || t('validation.allowedValues', { values: fieldProps.allowedValues.join(', ') });
    }
  }

  // Date range: schema "beforeToday" and "maxYearsAgo" (date inputs give "YYYY-MM-DD")
  if (value && el.type === 'date' && (fieldProps.beforeToday || fieldProps.maxYearsAgo)) {
    const date = parseLocalDate(value);
    if (!date) return t('validation.date');

    const { maxDate, minDate } = getDateLimits(fieldProps);
    if (maxDate && date > maxDate) {
      return fieldProps.beforeTodayMessage || t('validation.dateBeforeToday');
    }
    if (minDate && date < minDate) {
      return fieldProps.maxYearsAgoMessage || t('validation.dateMaxYearsAgo', { years: fieldProps.maxYearsAgo });
    }
  }

  return "";
};

/**
 * Builds the actions referenced by name in the schema (e.g. "onClick": "resetForm()") plus
 * methods for reading and setting field values from code.
 *   const formActions = createFormActions({ fieldRefs, setFormErrors, setFormValues, pendingValues, schema, data });
 * fieldRefs     - useRef({}) of field DOM nodes
 * setFormErrors - error state setter
 * setFormValues - tracked-values setter (drives visibleWhen / optionsFrom)
 * pendingValues - useRef({}) of values waiting for a field that isn't rendered yet
 *                 (hidden by visibleWhen, or a dependent select waiting for its parent)
 * schema        - full schema, for validation rules and formatting
 * data          - default values { [fieldName]: value }, restored by resetForm
 * onSubmit      - optional; called with getFormEntries() after a successful runValidation
 * setNodeState  - optional; setter for { [nodeId]: { hidden, removed, props } } used by the
 *                 element methods below (LayoutParser applies it to any schema node)
 * t             - optional; the form's translator, for "@key" schema messages and default messages
 * getNodeState  - optional; () => current element state, used to read runtime table rows
 */
export const createFormActions = ({ fieldRefs, setFormErrors, setFormValues, pendingValues, schema = [], data = {}, onSubmit, setNodeState, t = defaultTranslator, getNodeState = () => ({}) }) => {
  // Change one node's dynamic state: change(previousState) -> newState
  const updateNode = (id, change) => setNodeState?.((prev) => ({ ...prev, [id]: change(prev[id] || {}) }));

  // ---- DataTable helpers: runtime rows / columns / selection live in the node's element state ----
  const tableBase = (id) => findNode(schema, id)?.props || {};
  const currentTable = (id) => ({ ...tableBase(id), ...getNodeState()[id]?.props });
  // change(currentProps) -> props to merge (computed from the latest state, so calls can be chained)
  const updateTable = (id, change) => updateNode(id, (state) => {
    const current = { ...tableBase(id), ...state.props };
    return { ...state, props: { ...state.props, ...change(current) } };
  });
  const indexOfRow = (rows, keyOrIndex, rowKey) => (typeof keyOrIndex === 'number'
    ? keyOrIndex
    : rows.findIndex((row) => rowKeyOf(row, rowKey) === String(keyOrIndex)));
  // Forget validation errors of removed rows
  const clearRowErrors = (tableName, keys) => setFormErrors((prev) => Object.fromEntries(
    Object.entries(prev).filter(([name]) => !keys.some((key) => name.startsWith(`${tableName}.${key}.`)))
  ));
  // Tree: expanded ids (schema "expanded", or nodes flagged expanded: true)
  const treeExpanded = (p) => (p.expanded ?? initiallyExpanded(p.nodes || [])).map(String);
  const treeIds = (ids) => (Array.isArray(ids) ? ids : [ids]).filter((x) => x !== undefined && x !== null).map(String);
  // Chart series by key / name, or by index
  const chartSeriesMatches = (s, i, series) => (typeof series === 'number'
    ? i === series
    : String(s.key ?? s.name ?? `s${i}`) === String(series));
  const tableIdsByName = () => Object.fromEntries(tableNodesOf(schema).map((node) => [node.props?.name || node.id, node.id]));

  // Write values into mounted fields now; unmounted ones pick them up when they render.
  // A value for a DataTable's name replaces that table's rows.
  const writeValues = (newValues) => {
    const fieldProps = collectFieldProps(schema);
    const tables = tableIdsByName();
    const fieldValues = {};
    Object.entries(newValues).forEach(([name, value]) => {
      if (tables[name]) {
        updateTable(tables[name], () => ({ rows: normalizeRows(value), selected: [] }));
        return;
      }
      fieldValues[name] = value;
      setFieldDomValue(fieldRefs.current[name], value, fieldProps[name]);
    });
    if (pendingValues) pendingValues.current = { ...pendingValues.current, ...fieldValues };
    setFormValues?.((prev) => ({ ...prev, ...fieldValues }));
  };

  // Empty every mounted field and forget pending / tracked values
  const clearAll = () => {
    Object.values(fieldRefs.current).forEach((el) => setFieldDomValue(el, ''));
    if (pendingValues) pendingValues.current = {};
    setFormValues?.({});
    setFormErrors({});
  };

  return {
    // Set one field: formActions.setFieldValue("state", "California")
    setFieldValue: (name, value) => writeValues({ [name]: value }),

    // Set many fields: formActions.setFormData({ firstName: "JANE", contactPreferences: ["email"] })
    setFormData: (newData = {}) => writeValues(newData),

    // Values grouped per form copy: [{ firstName: "JOHN", ... }, { firstName: "RIYAZ", ... }]
    getFormEntries: () => getFormEntries(schema, fieldRefs, getNodeState()),

    // Current values of every rendered field, flat: { firstName: "JANE", firstName__2: "...", ... }
    getFormData: () => Object.fromEntries(
      Object.entries(fieldRefs.current).map(([name, el]) => [name, getFieldValue(el)])
    ),

    // A user edit wins over a pending value for that field and for selects that depend on it
    clearPendingValue: (name) => {
      if (!pendingValues?.current) return;
      const fieldProps = collectFieldProps(schema);
      const dependents = Object.keys(fieldProps).filter((key) => fieldProps[key].optionsFrom?.field === name);
      [name, ...dependents].forEach((key) => { delete pendingValues.current[key]; });
    },

    // ---- Element dynamics: work on any schema node by its "id" (rows, columns, text, fields, buttons) ----

    // Override props: setNodeProps("tag-h1", { text: "Hello" }) / ("tag-p", { style: { color: "red" } })
    // style is merged with earlier style overrides; other props replace
    setNodeProps: (id, props = {}) => updateNode(id, (state) => ({
      ...state,
      props: {
        ...state.props,
        ...props,
        ...(props.style && { style: { ...state.props?.style, ...props.style } }),
      },
    })),

    // Hide / show keep the element rendered (d-none), so hidden fields keep their values
    hideNode: (id) => updateNode(id, (state) => ({ ...state, hidden: true })),
    showNode: (id) => updateNode(id, (state) => ({ ...state, hidden: false })),
    toggleNode: (id) => updateNode(id, (state) => ({ ...state, hidden: !state.hidden })),

    // Remove takes the element out of the page entirely; restore brings it back
    removeNode: (id) => updateNode(id, (state) => ({ ...state, removed: true })),
    restoreNode: (id) => updateNode(id, (state) => ({ ...state, removed: false })),

    // Drop every change for one node, or for all nodes
    resetNode: (id) => setNodeState?.((prev) => {
      const { [id]: _removed, ...rest } = prev;
      return rest;
    }),
    resetNodes: () => setNodeState?.({}),

    // ---- DataTable: all take the table node's id ----

    // Rows (internal ids removed). Reflects state as of the last render.
    getRows: (id) => stripRowIds(normalizeRows(currentTable(id).rows)),
    setRows: (id, rows = []) => updateTable(id, () => ({ rows: normalizeRows(rows), selected: [] })),
    // Add a row (column defaultValues filled in) at the end or at a position
    addRow: (id, row = {}, position) => updateTable(id, (p) => {
      const rows = normalizeRows(p.rows);
      const newRow = { ...emptyRowFor(p.columns), ...row, [ROW_ID]: row[ROW_ID] ?? newRowId() };
      const at = position ?? rows.length;
      return { rows: [...rows.slice(0, at), newRow, ...rows.slice(at)] };
    }),
    // keyOrIndex: the row's rowKey value (or internal id) as a string, or its index as a number
    removeRow: (id, keyOrIndex) => {
      const current = currentTable(id);
      const rows = normalizeRows(current.rows);
      const index = indexOfRow(rows, keyOrIndex, current.rowKey);
      if (index < 0 || index >= rows.length) return;
      const key = rowKeyOf(rows[index], current.rowKey);
      clearRowErrors(current.name || id, [key]);
      updateTable(id, (p) => ({
        rows: normalizeRows(p.rows).filter((row) => rowKeyOf(row, p.rowKey) !== key),
        selected: (p.selected || []).filter((k) => String(k) !== key),
      }));
    },
    updateRow: (id, keyOrIndex, patch = {}) => updateTable(id, (p) => {
      const rows = normalizeRows(p.rows);
      const index = indexOfRow(rows, keyOrIndex, p.rowKey);
      if (index < 0 || index >= rows.length) return {};
      return { rows: rows.map((row, i) => (i === index ? { ...row, ...patch } : row)) };
    }),
    removeSelectedRows: (id) => {
      const current = currentTable(id);
      clearRowErrors(current.name || id, (current.selected || []).map(String));
      updateTable(id, (p) => {
        const selected = new Set((p.selected || []).map(String));
        return { rows: normalizeRows(p.rows).filter((row) => !selected.has(rowKeyOf(row, p.rowKey))), selected: [] };
      });
    },

    // Columns: { key, title, ... }; position = index among top-level columns
    addColumn: (id, column, position) => updateTable(id, (p) => {
      const columns = [...(p.columns || [])];
      columns.splice(position ?? columns.length, 0, column);
      return { columns };
    }),
    removeColumn: (id, key) => updateTable(id, (p) => ({ columns: removeColumnByKey(p.columns, key) })),
    // Change one column's options, e.g. updateColumn("orders", "amount", { look: { background: "#fff3cd" } })
    updateColumn: (id, key, patch = {}) => updateTable(id, (p) => ({ columns: updateColumnByKey(p.columns, key, patch) })),
    setColumns: (id, columns = []) => updateTable(id, () => ({ columns })),
    hideColumn: (id, key) => updateTable(id, (p) => ({ hiddenColumns: [...new Set([...hiddenColumnsOf(p), key])] })),
    showColumn: (id, key) => updateTable(id, (p) => ({ hiddenColumns: hiddenColumnsOf(p).filter((k) => k !== key) })),
    toggleColumn: (id, key) => updateTable(id, (p) => {
      const hidden = hiddenColumnsOf(p);
      return { hiddenColumns: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] };
    }),

    // Selection (row keys as strings)
    selectRows: (id, keys = []) => updateTable(id, () => ({ selected: keys.map(String) })),

    // Server paging ("serverSide": true): show the server's page and end loading; or show / end loading
    setPageRows: (id, { rows = [], totalRows, page } = {}) => updateTable(id, () => ({
      rows: normalizeRows(rows), selected: [], loading: false,
      ...(totalRows !== undefined && { totalRows }),
      ...(page !== undefined && { page }),
    })),
    setTableLoading: (id, loading = true) => updateTable(id, () => ({ loading: Boolean(loading) })),
    clearSelection: (id) => updateTable(id, () => ({ selected: [] })),
    getSelectedRows: (id) => {
      const p = currentTable(id);
      const selected = new Set((p.selected || []).map(String));
      return stripRowIds(normalizeRows(p.rows).filter((row) => selected.has(rowKeyOf(row, p.rowKey))));
    },

    // ---- Chart: all take the chart node's id (runtime data lives in its element state, like tables) ----
    // series: the series' key / name, or its index; point: a label or an index

    getChartData: (id) => {
      const p = currentTable(id);
      return { labels: p.labels || [], series: p.series || [] };
    },
    // Replace labels and / or series: setChartData("sales", { labels: [...], series: [...] })
    setChartData: (id, { labels, series } = {}) => updateTable(id, () => ({
      ...(labels && { labels }),
      ...(series && { series }),
    })),
    // Change one value: setChartValue("sales", "online", "Mar", 42)
    setChartValue: (id, series, point, value) => updateTable(id, (p) => {
      const index = typeof point === 'number' ? point : (p.labels || []).map(String).indexOf(String(point));
      if (index < 0) return {};
      return {
        series: (p.series || []).map((s, i) => {
          if (!chartSeriesMatches(s, i, series)) return s;
          const data = [...(s.data || [])];
          data[index] = value;
          return { ...s, data };
        }),
      };
    }),
    // Append a point to every series: addChartPoint("sales", "Jul", { online: 30, store: 12 }, { max: 12 })
    // (series missing from values get null); max keeps only the latest points, for live charts
    addChartPoint: (id, label, values = {}, { max } = {}) => updateTable(id, (p) => {
      const trim = (list) => (max && list.length > max ? list.slice(list.length - max) : list);
      return {
        ...(label !== undefined && label !== null && { labels: trim([...(p.labels || []), label]) }),
        series: (p.series || []).map((s, i) => {
          const key = s.key ?? s.name ?? `s${i}`;
          return { ...s, data: trim([...(s.data || []), values[key] ?? null]) };
        }),
      };
    }),
    removeChartPoint: (id, point) => updateTable(id, (p) => {
      const labels = p.labels || [];
      const index = typeof point === 'number' ? point : labels.map(String).indexOf(String(point));
      if (index < 0) return {};
      return {
        labels: labels.filter((_, i) => i !== index),
        series: (p.series || []).map((s) => ({ ...s, data: (s.data || []).filter((_, i) => i !== index) })),
      };
    }),
    addChartSeries: (id, series) => updateTable(id, (p) => ({ series: [...(p.series || []), series] })),
    removeChartSeries: (id, series) => updateTable(id, (p) => ({
      series: (p.series || []).filter((s, i) => !chartSeriesMatches(s, i, series)),
    })),
    // bar | line | area | pie | donut | scatter
    setChartType: (id, chartType) => updateTable(id, () => ({ chartType })),
    // highlightChart("sales", { series: "online", index: 2 }) — or { label: "Mar" }, or an array of them
    highlightChart: (id, highlight) => updateTable(id, () => ({ highlight })),
    clearHighlight: (id) => updateTable(id, () => ({ highlight: null })),
    // Hide / show a series (pie: a slice by its label); the legend uses this too
    toggleSeries: (id, key) => updateTable(id, (p) => {
      const hidden = (p.hiddenSeries || []).map(String);
      return { hiddenSeries: hidden.includes(String(key)) ? hidden.filter((k) => k !== String(key)) : [...hidden, String(key)] };
    }),

    // ---- File upload: all take the field's name ----
    getFiles: (name) => fieldRefs.current[name]?.rcubeUpload?.files() ?? [],
    uploadFiles: (name) => fieldRefs.current[name]?.rcubeUpload?.upload(),       // start queued uploads (autoUpload: false)
    clearFiles: (name) => fieldRefs.current[name]?.rcubeUpload?.clear(),
    removeFile: (name, fileId) => fieldRefs.current[name]?.rcubeUpload?.remove(fileId),
    retryFile: (name, fileId) => fieldRefs.current[name]?.rcubeUpload?.retry(fileId),
    openFilePicker: (name) => fieldRefs.current[name]?.rcubeUpload?.open(),
    // Add File objects from code (e.g. a screenshot blob turned into a File)
    addFiles: (name, files) => fieldRefs.current[name]?.rcubeUpload?.add(files, 'code'),

    // ---- Tree: all take the tree node's id; nodeId / parentId are tree item ids (parentId null = top level) ----

    getTreeNodes: (id) => currentTable(id).nodes || [],
    // Replace all nodes; { hasMore, cursor } for a paged top level
    setTreeNodes: (id, nodes = [], { hasMore, cursor } = {}) => updateTable(id, () => ({
      nodes, ...(hasMore !== undefined && { rootHasMore: hasMore }), ...(cursor !== undefined && { rootCursor: cursor }),
    })),
    getTreeNode: (id, nodeId) => findTreeNode(currentTable(id).nodes || [], nodeId)?.node ?? null,
    addTreeNode: (id, parentId, node, index) => updateTable(id, (p) => ({ nodes: insertTreeNode(p.nodes || [], parentId ?? null, node, index) })),
    updateTreeNode: (id, nodeId, patch = {}) => updateTable(id, (p) => ({ nodes: mapTreeNode(p.nodes || [], nodeId, (n) => ({ ...n, ...patch })) })),
    removeTreeNode: (id, nodeId) => updateTable(id, (p) => ({
      nodes: removeTreeNode(p.nodes || [], nodeId),
      selected: (p.selected || []).map(String).filter((x) => x !== String(nodeId)),
    })),
    moveTreeNode: (id, nodeId, parentId, index) => updateTable(id, (p) => ({ nodes: moveTreeNode(p.nodes || [], nodeId, parentId ?? null, index) })),
    // Children of a node loaded by your own code (instead of onLoadChildren); append: true adds a page
    setTreeChildren: (id, parentId, children = [], { hasMore = false, cursor, append = false } = {}) => updateTable(id, (p) => {
      if (parentId === null || parentId === undefined) {
        return { nodes: append ? [...(p.nodes || []), ...children] : children, rootHasMore: hasMore, rootCursor: cursor };
      }
      return { nodes: mapTreeNode(p.nodes || [], parentId, (n) => ({ ...n, children: append ? [...(n.children || []), ...children] : children, hasMore, cursor, hasChildren: true })) };
    }),
    // Forget a node's children (null = everything) so they load again
    reloadTreeNode: (id, nodeId = null) => updateTable(id, (p) => (nodeId === null
      ? { nodes: [], rootHasMore: false, rootCursor: undefined }
      : { nodes: mapTreeNode(p.nodes || [], nodeId, (n) => ({ ...n, children: undefined, hasChildren: true, hasMore: false, cursor: undefined })) })),
    // Expanding also opens the node's parents
    expandTreeNode: (id, nodeId) => updateTable(id, (p) => ({
      expanded: [...new Set([...treeExpanded(p), ...ancestorIds(p.nodes || [], nodeId), String(nodeId)])],
    })),
    collapseTreeNode: (id, nodeId) => updateTable(id, (p) => ({ expanded: treeExpanded(p).filter((x) => x !== String(nodeId)) })),
    toggleTreeNode: (id, nodeId) => updateTable(id, (p) => {
      const expanded = treeExpanded(p);
      return { expanded: expanded.includes(String(nodeId)) ? expanded.filter((x) => x !== String(nodeId)) : [...expanded, String(nodeId)] };
    }),
    expandAllTree: (id) => updateTable(id, (p) => {
      const ids = [];
      walkTree(p.nodes || [], (n) => { if (isBranch(n)) ids.push(String(n.id)); });
      return { expanded: ids };
    }),
    collapseAllTree: (id) => updateTable(id, () => ({ expanded: [] })),
    // Select (and scroll to) one id or several
    selectTreeNode: (id, nodeIds) => updateTable(id, () => {
      const ids = treeIds(nodeIds);
      return { selected: ids, ...(ids[0] && { scrollRequest: { id: ids[0], at: Date.now() } }) };
    }),
    getSelectedTreeNodes: (id) => {
      const p = currentTable(id);
      return (p.selected || []).map((x) => findTreeNode(p.nodes || [], x)?.node).filter(Boolean);
    },
    checkTreeNodes: (id, nodeIds) => updateTable(id, () => ({ checked: treeIds(nodeIds) })),
    getCheckedTreeNodes: (id) => {
      const p = currentTable(id);
      return (p.checked || []).map((x) => findTreeNode(p.nodes || [], x)?.node).filter(Boolean);
    },
    scrollToTreeNode: (id, nodeId) => updateTable(id, () => ({ scrollRequest: { id: String(nodeId), at: Date.now() } })),
    setTreeSearch: (id, search = '') => updateTable(id, () => ({ search })),
    setTreeFilters: (id, filterIds = []) => updateTable(id, () => ({ activeFilters: treeIds(filterIds) })),
    // tree | explorer | columns
    setTreeView: (id, view) => updateTable(id, () => ({ view })),
    // Explorer: show a folder's contents (null = top level)
    openTreeFolder: (id, nodeId = null) => updateTable(id, (p) => ({
      folder: nodeId === null ? null : String(nodeId),
      expanded: [...new Set([...treeExpanded(p), ...(nodeId === null ? [] : [...ancestorIds(p.nodes || [], nodeId), String(nodeId)])])],
    })),
    getTreeState: (id) => {
      const p = currentTable(id);
      return {
        view: p.view || 'tree', folder: p.folder ?? null, expanded: treeExpanded(p), selected: (p.selected || []).map(String),
        checked: (p.checked || []).map(String), search: p.search || '', activeFilters: (p.activeFilters || []).map(String),
      };
    },

    // ---- Calendar: all take the calendar node's id (runtime events / view / date live in its element state) ----

    getCalendarEvents: (id) => currentTable(id).events || [],
    // Replace the events, e.g. with an API response for the visible range (from onRangeChange)
    setCalendarEvents: (id, events = []) => updateTable(id, () => ({ events, loading: false })),
    addCalendarEvent: (id, event) => updateTable(id, (p) => ({
      events: [...(p.events || []), { id: event.id ?? `n${Date.now().toString(36)}`, ...event }],
    })),
    updateCalendarEvent: (id, eventId, patch = {}) => updateTable(id, (p) => ({
      events: (p.events || []).map((e, i) => (String(e.id ?? `e${i}`) === String(eventId) ? { ...e, ...patch } : e)),
    })),
    removeCalendarEvent: (id, eventId) => updateTable(id, (p) => ({
      events: (p.events || []).filter((e, i) => String(e.id ?? `e${i}`) !== String(eventId)),
    })),
    // day | week | month | year | agenda
    setCalendarView: (id, view) => updateTable(id, () => ({ view })),
    // "YYYY-MM-DD" or a Date
    setCalendarDate: (id, date) => updateTable(id, () => ({ date: dayKey(startOfDay(parseDate(date))) })),
    calendarToday: (id) => updateTable(id, () => ({ date: dayKey(new Date()) })),
    calendarNext: (id) => updateTable(id, (p) => ({ date: dayKey(shiftDate(p.view || 'week', p.date || new Date(), 1, p)) })),
    calendarPrev: (id) => updateTable(id, (p) => ({ date: dayKey(shiftDate(p.view || 'week', p.date || new Date(), -1, p)) })),
    // Visible range { view, date, start, end } (end exclusive), as passed to onRangeChange
    getCalendarRange: (id) => {
      const p = currentTable(id);
      const view = p.view || 'week';
      const date = p.date ? parseDate(p.date) : new Date();
      const { start, end } = rangeOf(view, date, p);
      return { view, date: dayKey(date), start: dayKey(start), end: dayKey(end) };
    },
    // Spinner while events load (setCalendarEvents turns it off)
    setCalendarLoading: (id, loading = true) => updateTable(id, () => ({ loading })),
    // Hide / show one calendar's events (the sidebar checkboxes use this too)
    toggleCalendar: (id, calendarId) => updateTable(id, (p) => {
      const hidden = (p.hiddenCalendars || []).map(String);
      const key = String(calendarId);
      return { hiddenCalendars: hidden.includes(key) ? hidden.filter((k) => k !== key) : [...hidden, key] };
    }),

    // Empty everything (ignores the default data)
    clearForm: () => clearAll(),

    // Back to the default data passed in as `data`
    resetForm: () => {
      clearAll();
      writeValues(data);
    },

    runValidation: () => {
      const fieldProps = collectFieldProps(schema);
      const newErrors = {};
      Object.entries(fieldRefs.current).forEach(([name, el]) => {
        // Fields hidden with hideNode (or inside a hidden row / column) are not validated
        if (el.closest?.('.d-none')) return;
        // translateProps turns "@key" messages from the schema into the active language
        const message = validateField(el, translateProps(fieldProps[name], t), t);
        if (message) newErrors[name] = message;
      });
      // Editable DataTable cells (keys like "orders.r2.qty")
      const tableResult = validateTables(schema, getNodeState(), t);
      Object.assign(newErrors, tableResult.errors);
      setFormErrors(newErrors);

      const firstInvalid = Object.keys(newErrors)[0];
      if (firstInvalid) {
        const el = fieldRefs.current[firstInvalid];
        if (el) {
          // A fieldset can't take focus, so focus its first radio instead
          const target = isChoiceGroup(el) ? el.querySelector('input') : el;
          // Let Tabs / Accordion open the pane holding the field, then focus it once it's visible
          target?.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));
          setTimeout(() => target?.focus(), 60);
        } else if (tableResult.owners[firstInvalid]) {
          // Table cell: open the pane holding the table; the table moves to the error's page; then focus
          const tableId = tableResult.owners[firstInvalid];
          const tableEl = [...document.querySelectorAll('[data-rcube-table]')].find((e) => e.getAttribute('data-rcube-table') === tableId);
          tableEl?.dispatchEvent(new CustomEvent(REVEAL_EVENT, { bubbles: true }));
          setTimeout(() => findVisibleByName(firstInvalid)?.focus(), 120);
        }
        return;
      }
      // One object per form copy, same keys in each: [{ firstName: "JOHN", ... }, { firstName: "RIYAZ", ... }]
      const entries = getFormEntries(schema, fieldRefs, getNodeState());
      if (onSubmit) onSubmit(entries);
      else console.log("Valid! Form entries:", entries);
      return entries;
    },
  };
};

/**
 * Run a schema action: a function, or a string like "zipChanged()" looked up in functionMap
 * (the form's actions object). Called as fn(event, context).
 */
export const runAction = (functionMap, action, event, context) => {
  if (typeof action === 'function') return action(event, context);
  if (typeof action !== 'string') return undefined;
  const functionName = action.replace(/\(\s*\)\s*$/, '').trim();
  const targetFunction = functionMap?.[functionName];
  if (typeof targetFunction === 'function') return targetFunction(event, context);
  console.warn(`Action "${functionName}" is not registered in formActions.`);
  return undefined;
};

// Schema event props are any "onXxx" key (onChange, onBlur, onFocus, onKeyDown, onClick, ...)
export const isEventProp = (key) => /^on[A-Z]/.test(key);

/**
 * Turn every schema event prop (e.g. "onBlur": "zipBlurred()") into a real handler that runs the
 * named formActions function. getContext(event) supplies the second argument.
 * Returns { [eventProp]: handler } for spreading onto a component.
 */
export const resolveEventProps = (props = {}, functionMap, getContext) => Object.fromEntries(
  Object.entries(props)
    .filter(([key, action]) => isEventProp(key) && (typeof action === 'string' || typeof action === 'function'))
    .map(([key, action]) => [key, (event) => runAction(functionMap, action, event, getContext?.(event))])
);

// Default Bootstrap variant per button type; the schema can override with "variant"
const buttonVariants = { submit: 'primary', reset: 'outline-secondary', button: 'outline-primary' };

export const ButtonField = ({ text, type = 'button', variant, functionMap, onClick, ...props }) => {
  return (
    <Button
      type={type}
      variant={variant || buttonVariants[type] || 'primary'}
      // onClick may be a schema string ("runValidation()") or an already-resolved function
      onClick={(event) => runAction(functionMap, onClick, event)}
      {...props}
    >
      {text}
    </Button>
  );
};
