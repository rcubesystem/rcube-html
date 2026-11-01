import { createContext, useContext } from "react";
import libEn from "./lang/lang_en";

const lookup = (source, key) => key.split('.').reduce((obj, part) => obj?.[part], source);

/**
 * Build a translator for one message set.
 *   const t = createTranslator(textEs, textEn);
 *   t('validation.numberRange', { min: 1, max: 100 }) -> "Introduzca un número entre 1 y 100."
 * Lookup order: messages -> fallback -> library English. Unknown keys return the key itself,
 * so a missing message is visible rather than blank. {placeholders} without a value stay as-is.
 */
export const createTranslator = (messages, fallback) => (key, values = {}) => {
  const template = lookup(messages, key) ?? lookup(fallback, key) ?? lookup(libEn, key);
  if (typeof template !== 'string') return key;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
};

// Library English only; used outside a form (or a <DynamicTag>) and as the default everywhere
export const defaultTranslator = createTranslator(libEn);

// Each <DynamicTag> provides its form's translator, so two forms can use different languages
export const I18nContext = createContext(defaultTranslator);
export const useTranslator = () => useContext(I18nContext);

// Schema text written as "@some.key" is a translation key, e.g. "label": "@form.firstName.label"
const TEXT_KEY_PREFIX = '@';
export const translateText = (value, t = defaultTranslator) =>
  (typeof value === 'string' && value.startsWith(TEXT_KEY_PREFIX) ? t(value.slice(TEXT_KEY_PREFIX.length)) : value);

/**
 * Translate every "@key" string inside a schema node's props (labels, placeholders, messages,
 * option labels, optionsFrom texts, ...). Data lookup tables under a "map" key are left untouched.
 * Strings without the "@" prefix pass through unchanged.
 */
export const translateProps = (value, t = defaultTranslator, key) => {
  if (typeof value === 'string') return translateText(value, t);
  if (Array.isArray(value)) return value.map((item) => translateProps(item, t));
  if (value && typeof value === 'object' && key !== 'map' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, translateProps(v, t, k)]));
  }
  return value;
};
