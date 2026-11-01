import { useEffect, useMemo, useRef, useState } from "react";
import { cloneSchema, createFormActions } from "./form";
import { createTranslator } from "./i18n";

// Rows over each repeated entry: "Entry N" heading, plus a Remove button on added copies
const buildCopyHeading = (copyId, index, t) => ({
  "type": "row", "id": `copy-heading-${copyId}`, "props": { "className": "mt-4 pb-2 border-bottom align-items-center" },
  "children": [
    { "type": "column", "id": `copy-heading-col-${copyId}`,
      "children": [{ "type": "H5", "id": `copy-heading-text-${copyId}`, "props": { "text": t('repeat.entry', { n: index + 1 }), "className": "mb-0" } }] },
    ...(copyId === 1 ? [] : [{ "type": "column", "id": `copy-remove-col-${copyId}`, "props": { "className": "d-flex justify-content-end" },
      "children": [{ "type": "ButtonField", "id": `copy-remove-${copyId}`, "props": {
        "text": "@repeat.remove", "variant": "outline-danger", "size": "sm",
        "data-copy-id": copyId, "onClick": "removeCopy()",
      } }] }]),
  ],
});

/**
 * All the state a schema-driven form needs, in one hook. Render it with <DynamicTag form={form} />.
 *
 *   const form = useDynamicTag({
 *     schema,                                  // form layout (rows / columns / fields)
 *     buttons,                                 // optional schema rendered once after the form
 *     messages: textEn,                        // optional page text for "@key" schema strings
 *     languages: { es: () => import('./text_es') },   // optional, loaded on demand
 *     actions: (api) => ({ fillDemo: () => api.setFormData({ ... }) }),
 *     onSubmit: (entries) => save(entries),    // after runValidation passes
 *     repeatable: true,                        // enables addCopy / removeCopy
 *   });
 *
 * Options
 *   schema      Array of schema nodes for the form.
 *   buttons     Array of schema nodes rendered once after all copies (not repeated).
 *   messages    Starting message set (usually the page's English text including rcube-html/lang/lang_en).
 *               Also the fallback for keys missing from other languages.
 *   languages   { code: messageSet | () => import(...) } for setLanguage(code).
 *   language    Starting language code (informational; `messages` is the starting text).
 *   actions     Object of extra actions, or (api) => object. Schema strings like "onClick": "fillDemo()"
 *               and "onBlur": "zipBlurred()" resolve to these; each is called as (event, context).
 *   onSubmit    (entries) => void, called with one object per copy after a successful runValidation.
 *   data        Default values restored by resetForm().
 *   repeatable  true to allow "+ Add Another" (addCopy) and per-copy "Remove" (removeCopy).
 *
 * Built-in actions (usable from the schema by name)
 *   runValidation, clearForm, resetForm, addCopy, removeCopy, switchLanguage, openModal, closeModal, selectTab
 *   ("switchLanguage()" reads the button's "data-lang" attribute, e.g. "data-lang": "es";
 *    "openModal()" / "closeModal()" read "data-modal"; "selectTab()" reads "data-tabs" and "data-key")
 *
 * Returns
 *   actions      every action / method (setFieldValue, setFormData, getFormEntries, setNodeProps, ...)
 *   t            the current translator: t('repeat.entry', { n: 2 })
 *   language     current language code
 *   setLanguage  (code) => Promise — load and activate a language from `languages`
 *   errors, values, fullSchema, parserProps   used by <DynamicTag>; available for custom rendering
 */
export const useDynamicTag = ({
  schema = [],
  buttons = [],
  messages,
  languages = {},
  language: initialLanguage = null,
  actions: customActions,
  onSubmit,
  data,
  repeatable = false,
} = {}) => {
  // { [fieldName]: DOM element }
  const fieldRefs = useRef({});
  // Values set in code that fields apply when they render (hidden / dependent fields)
  const pendingValues = useRef({});
  // { [fieldName]: error message }
  const [errors, setErrors] = useState({});
  // { [fieldName]: value } — drives visibleWhen / optionsFrom
  const [values, setValues] = useState({});
  // { [nodeId]: { hidden, removed, props } } — runtime element changes
  const [nodeState, setNodeState] = useState({});
  // Latest element state for actions that read it (getRows, getSelectedRows, getFormEntries)
  const nodeStateRef = useRef(nodeState);
  nodeStateRef.current = nodeState;
  // Copy ids of the repeated form; ids are never reused so removing one doesn't rename the rest
  const [copyIds, setCopyIds] = useState([1]);
  const nextCopyId = useRef(2);
  // Active language; `messages` stays the fallback for every language
  const [lang, setLang] = useState({ code: initialLanguage, messages: messages || null });
  const revalidateAfterLanguage = useRef(false);

  const t = useMemo(() => createTranslator(lang.messages, messages), [lang.messages, messages]);

  // Copy 1 keeps the original names; copy N gets "__N" on every id / field name (firstName__2)
  const formSchema = useMemo(() => {
    if (!repeatable || copyIds.length === 1) return schema;
    return copyIds.flatMap((copyId, index) => [
      buildCopyHeading(copyId, index, t),
      ...(copyId === 1 ? schema : cloneSchema(schema, `__${copyId}`)),
    ]);
  }, [schema, repeatable, copyIds, t]);

  const fullSchema = useMemo(() => [...formSchema, ...buttons], [formSchema, buttons]);

  const actions = createFormActions({
    fieldRefs, pendingValues, setFormErrors: setErrors, setFormValues: setValues, setNodeState,
    schema: fullSchema, data, onSubmit, t, getNodeState: () => nodeStateRef.current,
  });

  // ---- Repeatable entries ----
  actions.addCopy = () => {
    if (!repeatable) return;
    const copyId = nextCopyId.current++;
    setCopyIds((ids) => [...ids, copyId]);
  };
  // From a Remove button (reads data-copy-id) or from code: actions.removeCopy(3)
  actions.removeCopy = (eventOrId) => {
    const copyId = typeof eventOrId === 'number' ? eventOrId : Number(eventOrId?.currentTarget?.dataset.copyId);
    if (!copyId || copyId === 1) return; // the original entry can't be removed
    setCopyIds((ids) => ids.filter((id) => id !== copyId));
    // The copy's fields unmount on their own; drop its errors / tracked / pending values too
    const suffix = `__${copyId}`;
    const withoutCopy = (obj) => Object.fromEntries(Object.entries(obj).filter(([name]) => !name.endsWith(suffix)));
    setErrors(withoutCopy);
    setValues(withoutCopy);
    pendingValues.current = withoutCopy(pendingValues.current);
  };

  // ---- Containers ----
  // Read a target node id from a button's data-* attribute, or take it directly from code
  const targetId = (eventOrId, attribute) => (typeof eventOrId === 'string' ? eventOrId : eventOrId?.currentTarget?.dataset?.[attribute]);
  // Button { "data-modal": "m1", "onClick": "openModal()" } or actions.openModal("m1")
  actions.openModal = (eventOrId) => {
    const id = targetId(eventOrId, 'modal');
    if (id) actions.setNodeProps(id, { show: true });
  };
  actions.closeModal = (eventOrId) => {
    const id = targetId(eventOrId, 'modal');
    if (id) actions.setNodeProps(id, { show: false });
  };
  // Button { "data-tabs": "t1", "data-key": "address", "onClick": "selectTab()" } or actions.selectTab("t1", "address").
  // Works for Accordion too. activeKeyRequest makes repeated requests for the same key take effect.
  actions.selectTab = (eventOrId, key) => {
    const id = targetId(eventOrId, 'tabs');
    const activeKey = key ?? eventOrId?.currentTarget?.dataset?.key;
    if (id && activeKey != null) actions.setNodeProps(id, { activeKey, activeKeyRequest: Date.now() });
  };

  // ---- Language ----
  // Load (if needed) and activate a language from `languages`; error messages on screen re-run
  const setLanguage = async (code) => {
    if (code === lang.code) return;
    const source = languages[code];
    if (!source) {
      console.warn(`Language "${code}" is not in useDynamicTag({ languages }).`);
      return;
    }
    const loaded = typeof source === 'function' ? await source() : source;
    revalidateAfterLanguage.current = Object.values(errors).some(Boolean);
    setLang({ code, messages: loaded?.default ?? loaded });
  };
  // From a button: { "data-lang": "es", "onClick": "switchLanguage()" }, or from code: switchLanguage('es')
  actions.switchLanguage = (eventOrCode) => setLanguage(
    typeof eventOrCode === 'string' ? eventOrCode : eventOrCode?.currentTarget?.dataset.lang
  );

  // Re-validate once the new translator is active so visible errors show in the new language
  useEffect(() => {
    if (!revalidateAfterLanguage.current) return;
    revalidateAfterLanguage.current = false;
    actions.runValidation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // ---- Project actions (schema names -> functions); may build on the actions above ----
  Object.assign(actions, typeof customActions === 'function' ? customActions(actions) : customActions);

  // Track the value and clear the field's error as soon as the user edits it
  const onFieldChange = (e, name, value) => {
    actions.clearPendingValue(name); // the user's edit wins over a code-set value
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  return {
    actions,
    t,
    language: lang.code,
    setLanguage,
    errors,
    values,
    fullSchema,
    parserProps: { functionMap: actions, fieldRefs, errors, onFieldChange, values, pendingValues, nodeState },
  };
};
