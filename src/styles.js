import css from "./styles.css";

/*
 * rcube-html's stylesheet (built by scripts/build-styles.mjs). Two ways to load it:
 *   import "rcube-html/styles.css"   in the app (best: it's in the page before anything renders, no flash)
 *   nothing                          rcube-html adds it itself, once, the first time it loads in a browser
 *                                    (a page that already has it — the --rc-styles variable is set — is left alone)
 */
export const RCUBE_HTML_CSS = css;

const STYLE_ID = "rcube-html-styles";

/** Add the stylesheet to <head> unless the page already has it */
export function ensureStyles(doc = typeof document !== "undefined" ? document : null) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  try {
    const loaded = doc.defaultView?.getComputedStyle(doc.documentElement).getPropertyValue("--rc-styles").trim();
    if (loaded) return;
  } catch { /* no computed styles: add it */ }
  const el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = css;
  // first in <head>, so the page's own CSS (loaded after) can still override it
  doc.head.insertBefore(el, doc.head.firstChild);
}
