/*
 * The view store — what a person chose on a page (a table's page, rows per page, sort and search; the page's filters),
 * kept in this browser's localStorage so they pick up where they left off. Each entry expires `days` after it was last
 * used (default 7); expired entries are dropped when read, and all at once by purgeExpiredViews().
 *
 *   configureViewStore({ namespace: `${userId}.${orgId}`, user: userId, enabled: true, days: 7 })   (once signed in)
 *   readView("students")  -> the saved value or null       saveView("students", value)
 *   clearView("students") -> drops it and "students:…" (e.g. its filters)     hasView("students") -> saved anything?
 *   clearAllViews()       -> every saved choice of this person (all schools)  purgeExpiredViews() -> dropped count
 *
 * Keys: "rcube.view.<namespace>.<key>" -> { v: value, at: last used (ms) }. Nothing is saved while disabled (or
 * without a namespace: nobody signed in). A DataTable saves its own view with the schema prop `remember`.
 * Changes are announced on window ("rcube:viewstore") so tables can show / hide their Reset button.
 */
const PREFIX = 'rcube.view.';
const EVENT = 'rcube:viewstore';
const state = { namespace: '', user: '', enabled: true, days: 7 };

const storage = () => {
  try { return typeof window !== 'undefined' ? window.localStorage : null; } catch { return null; }
};
// after the current work (never while a component renders: listeners update their state)
const announce = (key) => { try { setTimeout(() => window.dispatchEvent(new CustomEvent(EVENT, { detail: { key } })), 0); } catch { /* no window */ } };
const full = (key) => `${PREFIX}${state.namespace}.${key}`;
const expired = (entry, now = Date.now()) => !entry || typeof entry.at !== 'number' || now - entry.at > state.days * 86400000;
const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };

export const VIEW_STORE_EVENT = EVENT;

/** Who's signed in and how long choices are kept; enabled: false stops saving (what's saved stays until cleared) */
export const configureViewStore = ({ namespace, user, enabled, days } = {}) => {
  const before = JSON.stringify(state);
  if (namespace !== undefined) state.namespace = String(namespace || '');
  if (user !== undefined) state.user = String(user || '');
  if (enabled !== undefined) state.enabled = enabled !== false;
  if (Number(days) > 0) state.days = Number(days);
  if (JSON.stringify(state) !== before) announce('*'); // only a real change (it's called on every render of a layout)
};
export const viewStoreSettings = () => ({ ...state });
const active = () => state.enabled && Boolean(state.namespace) && Boolean(storage());

/** The saved value (and it's used now: the week starts again), or null */
export const readView = (key) => {
  if (!active() || !key) return null;
  const s = storage();
  const entry = parse(s.getItem(full(key)));
  if (!entry) return null;
  if (expired(entry)) { s.removeItem(full(key)); return null; }
  try { s.setItem(full(key), JSON.stringify({ v: entry.v, at: Date.now() })); } catch { /* full: still usable */ }
  return entry.v;
};
/** Save (value null / undefined: forget this key only, not its sub-keys) */
export const saveView = (key, value) => {
  if (!active() || !key) return;
  try {
    if (value == null) storage().removeItem(full(key)); else storage().setItem(full(key), JSON.stringify({ v: value, at: Date.now() }));
    announce(key);
  } catch { /* storage full or blocked */ }
};
const keysOf = (prefix) => {
  const s = storage();
  if (!s) return [];
  const out = [];
  for (let i = 0; i < s.length; i += 1) { const k = s.key(i); if (k && k.startsWith(prefix)) out.push(k); }
  return out;
};
/** Drop a key and its sub-keys ("students" and "students:filters") */
export const clearView = (key) => {
  if (!key || !state.namespace) return;
  const s = storage();
  if (!s) return;
  const base = full(key);
  for (const k of keysOf(base)) if (k === base || k.startsWith(`${base}:`)) s.removeItem(k);
  announce(key);
};
/** Anything saved under the key (or its sub-keys), not expired? */
export const hasView = (key) => {
  if (!active() || !key) return false;
  const s = storage();
  const base = full(key);
  return keysOf(base).some((k) => (k === base || k.startsWith(`${base}:`)) && !expired(parse(s.getItem(k))));
};
/** Every saved choice of the signed-in person (every school), or of everyone in this browser (all: true) */
export const clearAllViews = ({ all = false } = {}) => {
  const s = storage();
  if (!s) return 0;
  const prefix = all || !state.user ? PREFIX : `${PREFIX}${state.user}.`;
  const keys = keysOf(prefix);
  for (const k of keys) s.removeItem(k);
  announce('*');
  return keys.length;
};
/** Drop every expired entry (e.g. at sign-in) -> how many */
export const purgeExpiredViews = () => {
  const s = storage();
  if (!s) return 0;
  const now = Date.now();
  let n = 0;
  for (const k of keysOf(PREFIX)) if (expired(parse(s.getItem(k)), now)) { s.removeItem(k); n += 1; }
  return n;
};
