// Builds src/styles.css: rcube-html's whole stylesheet (no Bootstrap needed).
//   tokens      --rc-* variables; each falls back to Bootstrap's --bs-* when Bootstrap is on the page, else to its value
//   components  src/styles/components.css (hand-written)
//   variants    buttons, badges, alerts, tables, list items, text / background / border colours
//   layout      the 12-column grid (rc-row, rc-col-*, rc-g-*), containers
//   utilities   rc-d-*, rc-m*/p*-*, rc-gap-*, rc-text-*, rc-fw-*, ... (the same names as Bootstrap's, with rc-)
// Run: node scripts/build-styles.mjs (npm run build does it first). The file is imported by src/styles.js (injected
// when the page hasn't loaded it) and copied to dist/styles.css (import "rcube-html/styles.css").
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");

// Bootstrap 5.3's colours (used when --bs-* isn't there); text: readable text on the solid colour
const COLORS = {
  primary: ["#0d6efd", "13, 110, 253", "#fff"],
  secondary: ["#6c757d", "108, 117, 125", "#fff"],
  success: ["#198754", "25, 135, 84", "#fff"],
  info: ["#0dcaf0", "13, 202, 240", "#000"],
  warning: ["#ffc107", "255, 193, 7", "#000"],
  danger: ["#dc3545", "220, 53, 69", "#fff"],
  light: ["#f8f9fa", "248, 249, 250", "#000"],
  dark: ["#212529", "33, 37, 41", "#fff"],
};
const NAMES = Object.keys(COLORS);
const BP = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1400 };
const CONTAINER = { sm: 540, md: 720, lg: 960, xl: 1140, xxl: 1320 };
const SPACE = { 0: "0", 1: ".25rem", 2: ".5rem", 3: "1rem", 4: "1.5rem", 5: "3rem" };
const out = [];
const add = (s) => out.push(s);
const media = (bp, body) => (bp ? `@media (min-width: ${BP[bp]}px) {\n${body}\n}` : body);

// ---------------------------------------------------------------- tokens
const light = {
  "font-size": "var(--bs-body-font-size, 1rem)",
  "body-color": "var(--bs-body-color, #212529)", "body-color-rgb": "var(--bs-body-color-rgb, 33, 37, 41)",
  "body-bg": "var(--bs-body-bg, #fff)", "body-bg-rgb": "var(--bs-body-bg-rgb, 255, 255, 255)",
  "emphasis-color": "var(--bs-emphasis-color, #000)", "emphasis-rgb": "var(--bs-emphasis-color-rgb, 0, 0, 0)",
  "secondary-color": "var(--bs-secondary-color, rgba(33, 37, 41, .75))",
  "secondary-bg": "var(--bs-secondary-bg, #e9ecef)", "tertiary-bg": "var(--bs-tertiary-bg, #f8f9fa)",
  "border-width": "var(--bs-border-width, 1px)",
  "border-color": "var(--bs-border-color, #dee2e6)", "border-color-translucent": "var(--bs-border-color-translucent, rgba(0, 0, 0, .175))",
  "border-radius": "var(--bs-border-radius, .375rem)", "border-radius-sm": "var(--bs-border-radius-sm, .25rem)", "border-radius-lg": "var(--bs-border-radius-lg, .5rem)",
  "link-color": "var(--bs-link-color, var(--rc-primary))", "link-hover-color": "var(--bs-link-hover-color, color-mix(in srgb, var(--rc-link-color) 80%, #000))",
  "box-shadow": "var(--bs-box-shadow, 0 .5rem 1rem rgba(0, 0, 0, .15))",
  "input-bg": "var(--rc-body-bg)", "input-border-color": "var(--rc-border-color)",
  "input-focus-border-color": "color-mix(in srgb, var(--rc-primary) 50%, var(--rc-body-bg))",
  "focus-ring": "0 0 0 .25rem rgba(var(--rc-primary-rgb), .25)",
  "z-dropdown": "1000", "z-modal-backdrop": "1050", "z-modal": "1055", "z-popover": "1070", "z-tooltip": "1080",
};
for (const [n, [hex, rgb]] of Object.entries(COLORS)) {
  light[n] = `var(--bs-${n}, ${hex})`;
  light[`${n}-rgb`] = `var(--bs-${n}-rgb, ${rgb})`;
  light[`${n}-text`] = `var(--bs-${n}-text-emphasis, color-mix(in srgb, var(--rc-${n}) 60%, #000))`;
  light[`${n}-bg-subtle`] = `var(--bs-${n}-bg-subtle, color-mix(in srgb, var(--rc-${n}) 16%, var(--rc-body-bg)))`;
  light[`${n}-border-subtle`] = `var(--bs-${n}-border-subtle, color-mix(in srgb, var(--rc-${n}) 40%, var(--rc-body-bg)))`;
}
const vars = (o) => Object.entries(o).map(([k, v]) => `  --rc-${k}: ${v};`).join("\n");
add(`/*! rcube-html styles — no Bootstrap needed. Colours, radius and sizes are --rc-* variables: set them on :root (or any
 * element) to restyle rcube-html; each one follows Bootstrap's --bs-* variable when Bootstrap is on the page.
 * Dark: data-rc-theme="dark" (or Bootstrap's data-bs-theme="dark") on <html> or any element. */`);
// re-read where a theme changes, so --bs-* of that element apply
add(`:root, [data-bs-theme], [data-rc-theme] {\n  --rc-styles: 1;\n${vars(light)}\n}`);
const dark = {
  "body-color": "var(--bs-body-color, #dee2e6)", "body-color-rgb": "var(--bs-body-color-rgb, 222, 226, 230)",
  "body-bg": "var(--bs-body-bg, #212529)", "body-bg-rgb": "var(--bs-body-bg-rgb, 33, 37, 41)",
  "emphasis-color": "var(--bs-emphasis-color, #fff)", "emphasis-rgb": "var(--bs-emphasis-color-rgb, 255, 255, 255)",
  "secondary-color": "var(--bs-secondary-color, rgba(222, 226, 230, .75))",
  "secondary-bg": "var(--bs-secondary-bg, #343a40)", "tertiary-bg": "var(--bs-tertiary-bg, #2b3035)",
  "border-color": "var(--bs-border-color, #495057)", "border-color-translucent": "var(--bs-border-color-translucent, rgba(255, 255, 255, .15))",
  "link-color": "var(--bs-link-color, #6ea8fe)", "link-hover-color": "var(--bs-link-hover-color, #8bb9fe)",
  "btn-close-filter": "invert(1) grayscale(100%) brightness(200%)",
};
for (const n of NAMES) dark[`${n}-text`] = `var(--bs-${n}-text-emphasis, color-mix(in srgb, var(--rc-${n}) 60%, #fff))`;
add(`[data-rc-theme="dark"], [data-bs-theme="dark"] {\n  color-scheme: dark;\n${vars(dark)}\n}`);

// ---------------------------------------------------------------- components
add(readFileSync(join(src, "styles", "components.css"), "utf8"));

// ---------------------------------------------------------------- variants
for (const [n, [, , text]] of Object.entries(COLORS)) {
  const c = `var(--rc-${n})`;
  const hover = n === "light" ? `color-mix(in srgb, ${c} 92%, #000)` : n === "dark" ? `color-mix(in srgb, ${c} 85%, #fff)` : `color-mix(in srgb, ${c} 85%, #000)`;
  const active = n === "light" ? `color-mix(in srgb, ${c} 88%, #000)` : n === "dark" ? `color-mix(in srgb, ${c} 75%, #fff)` : `color-mix(in srgb, ${c} 80%, #000)`;
  add(`.rc-btn-${n} { --rc-btn-color: ${text}; --rc-btn-bg: ${c}; --rc-btn-border: ${c}; --rc-btn-hover-color: ${text}; --rc-btn-hover-bg: ${hover}; --rc-btn-hover-border: ${hover}; --rc-btn-active-bg: ${active}; --rc-btn-active-border: ${active}; --rc-btn-focus-rgb: var(--rc-${n}-rgb); }`);
  const outlineColor = n === "light" ? `var(--rc-body-color)` : c;
  add(`.rc-btn-outline-${n} { --rc-btn-color: ${outlineColor}; --rc-btn-border: ${n === "light" ? "var(--rc-border-color)" : c}; --rc-btn-hover-color: ${text}; --rc-btn-hover-bg: ${c}; --rc-btn-hover-border: ${c}; --rc-btn-active-color: ${text}; --rc-btn-active-bg: ${c}; --rc-btn-active-border: ${c}; --rc-btn-focus-rgb: var(--rc-${n}-rgb); }`);
  add(`.rc-badge-${n}, .rc-text-bg-${n} { color: ${text} !important; background-color: ${c} !important; }`);
  add(`.rc-alert-${n} { --rc-alert-color: var(--rc-${n}-text); --rc-alert-bg: var(--rc-${n}-bg-subtle); --rc-alert-border-color: var(--rc-${n}-border-subtle); }`);
  add(`.rc-list-group-item-${n} { --rc-list-item-color: var(--rc-${n}-text); --rc-list-item-bg: var(--rc-${n}-bg-subtle); }`);
  // a coloured table, row or cell: its own background (Bootstrap's table-<name>); stripes / hover darken it
  const bg = n === "dark" ? c : `var(--rc-${n}-bg-subtle)`;
  const fg = n === "dark" ? "#fff" : `var(--rc-emphasis-color)`;
  add(`.rc-table-${n} { --rc-table-color: ${fg}; --rc-table-bg: ${bg}; --rc-table-border-color: color-mix(in srgb, ${bg} 80%, ${fg}); --rc-table-striped-bg: color-mix(in srgb, ${bg} 95%, ${fg}); --rc-table-striped-color: ${fg}; --rc-table-active-bg: color-mix(in srgb, ${bg} 90%, ${fg}); --rc-table-active-color: ${fg}; --rc-table-hover-bg: color-mix(in srgb, ${bg} 92.5%, ${fg}); --rc-table-hover-color: ${fg}; color: var(--rc-table-color); border-color: var(--rc-table-border-color); }`);
  add(`.rc-text-${n} { color: ${c} !important; }`);
  add(`.rc-bg-${n} { background-color: ${c} !important; }`);
  add(`.rc-bg-${n}-subtle { background-color: var(--rc-${n}-bg-subtle) !important; }`);
  add(`.rc-text-${n}-emphasis { color: var(--rc-${n}-text) !important; }`);
  add(`.rc-border-${n}-subtle { border-color: var(--rc-${n}-border-subtle) !important; }`);
  add(`.rc-border-${n} { border-color: ${c} !important; }`);
}
add(`.rc-text-body { color: var(--rc-body-color) !important; }
.rc-text-muted, .rc-text-body-secondary { color: var(--rc-secondary-color) !important; }
.rc-text-body-emphasis { color: var(--rc-emphasis-color) !important; }
.rc-text-white { color: #fff !important; }
.rc-text-black { color: #000 !important; }
.rc-bg-body { background-color: var(--rc-body-bg) !important; }
.rc-bg-body-secondary { background-color: var(--rc-secondary-bg) !important; }
.rc-bg-body-tertiary { background-color: var(--rc-tertiary-bg) !important; }
.rc-bg-white { background-color: #fff !important; }
.rc-bg-transparent { background-color: transparent !important; }`);

// ---------------------------------------------------------------- grid / containers
const gridFor = (bp) => {
  const p = bp ? `${bp}-` : "";
  const rules = bp ? [`.rc-col-${bp} { flex: 1 0 0%; }`] : [];
  rules.push(`.rc-col-${p}auto { flex: 0 0 auto; width: auto; }`);
  for (let i = 1; i <= 12; i += 1) rules.push(`.rc-col-${p}${i} { flex: 0 0 auto; width: ${+(i / 12 * 100).toFixed(8)}%; }`);
  for (const [k, v] of Object.entries(SPACE)) {
    rules.push(`.rc-g-${p}${k}, .rc-gx-${p}${k} { --rc-gutter-x: ${v}; }`);
    rules.push(`.rc-g-${p}${k}, .rc-gy-${p}${k} { --rc-gutter-y: ${v}; }`);
  }
  return rules.join("\n");
};
add(gridFor(""));
for (const bp of Object.keys(BP)) add(media(bp, gridFor(bp)));
for (const [bp, w] of Object.entries(CONTAINER)) add(media(bp, `.rc-container { max-width: ${w}px; }`));

// ---------------------------------------------------------------- utilities (Bootstrap's names, with rc-)
// "none" last, as in Bootstrap: a hidden node (rc-d-none) stays hidden whatever other display class it has
const DISPLAY = ["inline", "inline-block", "block", "grid", "table", "table-cell", "table-row", "flex", "inline-flex", "none"];
const utilitiesFor = (bp) => {
  const p = bp ? `${bp}-` : "";
  const r = [];
  for (const d of DISPLAY) r.push(`.rc-d-${p}${d} { display: ${d} !important; }`);
  const sides = { m: ["margin"], mt: ["margin-top"], mb: ["margin-bottom"], ms: ["margin-left"], me: ["margin-right"], mx: ["margin-left", "margin-right"], my: ["margin-top", "margin-bottom"],
    p: ["padding"], pt: ["padding-top"], pb: ["padding-bottom"], ps: ["padding-left"], pe: ["padding-right"], px: ["padding-left", "padding-right"], py: ["padding-top", "padding-bottom"] };
  // spacing: no breakpoint versions (no rc-mt-md-3; use the grid's gutters or a class of your own)
  for (const [k, props] of Object.entries(bp ? {} : sides)) {
    for (const [s, v] of Object.entries({ ...SPACE, ...(k.startsWith("m") ? { auto: "auto" } : {}) })) {
      r.push(`.rc-${k}-${p}${s} { ${props.map((x) => `${x}: ${v} !important;`).join(" ")} }`);
    }
  }
  if (!bp) for (const [s, v] of Object.entries(SPACE)) r.push(`.rc-gap-${s} { gap: ${v} !important; }`);
  for (const [k, v] of Object.entries({ row: "row", column: "column", "row-reverse": "row-reverse", "column-reverse": "column-reverse" })) r.push(`.rc-flex-${p}${k} { flex-direction: ${v} !important; }`);
  r.push(`.rc-flex-${p}wrap { flex-wrap: wrap !important; }`, `.rc-flex-${p}nowrap { flex-wrap: nowrap !important; }`, `.rc-flex-${p}fill { flex: 1 1 auto !important; }`,
    `.rc-flex-${p}grow-0 { flex-grow: 0 !important; }`, `.rc-flex-${p}grow-1 { flex-grow: 1 !important; }`,
    `.rc-flex-${p}shrink-0 { flex-shrink: 0 !important; }`, `.rc-flex-${p}shrink-1 { flex-shrink: 1 !important; }`);
  for (const [k, v] of Object.entries({ start: "flex-start", end: "flex-end", center: "center", between: "space-between", around: "space-around", evenly: "space-evenly" })) r.push(`.rc-justify-content-${p}${k} { justify-content: ${v} !important; }`);
  for (const [k, v] of Object.entries({ start: "flex-start", end: "flex-end", center: "center", baseline: "baseline", stretch: "stretch" })) {
    r.push(`.rc-align-items-${p}${k} { align-items: ${v} !important; }`);
    if (!bp) r.push(`.rc-align-self-${k} { align-self: ${v} !important; }`);
  }
  for (const [k, v] of Object.entries({ start: "left", end: "right", center: "center" })) r.push(`.rc-text-${p}${k} { text-align: ${v} !important; }`);
  return r.join("\n");
};
add(utilitiesFor(""));
for (const bp of Object.keys(BP)) add(media(bp, utilitiesFor(bp)));
add(`.rc-small { font-size: .875em !important; }
.rc-lead { font-size: 1.25rem; font-weight: 300; }
.rc-fs-1 { font-size: 2.5rem !important; } .rc-fs-2 { font-size: 2rem !important; } .rc-fs-3 { font-size: 1.75rem !important; }
.rc-fs-4 { font-size: 1.5rem !important; } .rc-fs-5 { font-size: 1.25rem !important; } .rc-fs-6 { font-size: 1rem !important; }
.rc-fw-light { font-weight: 300 !important; } .rc-fw-normal { font-weight: 400 !important; } .rc-fw-medium { font-weight: 500 !important; }
.rc-fw-semibold { font-weight: 600 !important; } .rc-fw-bold { font-weight: 700 !important; } .rc-fw-bolder { font-weight: bolder !important; }
.rc-fst-italic { font-style: italic !important; } .rc-fst-normal { font-style: normal !important; }
.rc-font-monospace { font-family: SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace !important; }
.rc-lh-1 { line-height: 1 !important; } .rc-lh-sm { line-height: 1.25 !important; } .rc-lh-base { line-height: 1.5 !important; }
.rc-text-truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rc-text-break { word-wrap: break-word !important; word-break: break-word !important; }
.rc-text-nowrap { white-space: nowrap !important; } .rc-text-wrap { white-space: normal !important; }
.rc-text-uppercase { text-transform: uppercase !important; } .rc-text-lowercase { text-transform: lowercase !important; } .rc-text-capitalize { text-transform: capitalize !important; }
.rc-text-decoration-none { text-decoration: none !important; }
.rc-align-baseline { vertical-align: baseline !important; } .rc-align-top { vertical-align: top !important; } .rc-align-middle { vertical-align: middle !important; }
.rc-align-bottom { vertical-align: bottom !important; } .rc-align-text-top { vertical-align: text-top !important; } .rc-align-text-bottom { vertical-align: text-bottom !important; }
.rc-w-25 { width: 25% !important; } .rc-w-50 { width: 50% !important; } .rc-w-75 { width: 75% !important; } .rc-w-100 { width: 100% !important; } .rc-w-auto { width: auto !important; }
.rc-h-25 { height: 25% !important; } .rc-h-50 { height: 50% !important; } .rc-h-75 { height: 75% !important; } .rc-h-100 { height: 100% !important; } .rc-h-auto { height: auto !important; }
.rc-mw-100 { max-width: 100% !important; } .rc-mh-100 { max-height: 100% !important; } .rc-vw-100 { width: 100vw !important; } .rc-vh-100 { height: 100vh !important; }
.rc-border { border: var(--rc-border-width) solid var(--rc-border-color) !important; } .rc-border-0 { border: 0 !important; }
.rc-border-top { border-top: var(--rc-border-width) solid var(--rc-border-color) !important; } .rc-border-top-0 { border-top: 0 !important; }
.rc-border-bottom { border-bottom: var(--rc-border-width) solid var(--rc-border-color) !important; } .rc-border-bottom-0 { border-bottom: 0 !important; }
.rc-border-start { border-left: var(--rc-border-width) solid var(--rc-border-color) !important; } .rc-border-start-0 { border-left: 0 !important; }
.rc-border-end { border-right: var(--rc-border-width) solid var(--rc-border-color) !important; } .rc-border-end-0 { border-right: 0 !important; }
.rc-border-1 { border-width: 1px !important; } .rc-border-2 { border-width: 2px !important; } .rc-border-3 { border-width: 3px !important; }
.rc-border-4 { border-width: 4px !important; } .rc-border-5 { border-width: 5px !important; }
.rc-rounded { border-radius: var(--rc-border-radius) !important; } .rc-rounded-0 { border-radius: 0 !important; }
.rc-rounded-1 { border-radius: var(--rc-border-radius-sm) !important; } .rc-rounded-2 { border-radius: var(--rc-border-radius) !important; } .rc-rounded-3 { border-radius: var(--rc-border-radius-lg) !important; }
.rc-rounded-circle { border-radius: 50% !important; } .rc-rounded-pill { border-radius: 50rem !important; }
.rc-shadow { box-shadow: var(--rc-box-shadow) !important; } .rc-shadow-sm { box-shadow: 0 .125rem .25rem rgba(0, 0, 0, .075) !important; }
.rc-shadow-lg { box-shadow: 0 1rem 3rem rgba(0, 0, 0, .175) !important; } .rc-shadow-none { box-shadow: none !important; }
.rc-position-static { position: static !important; } .rc-position-relative { position: relative !important; } .rc-position-absolute { position: absolute !important; }
.rc-position-fixed { position: fixed !important; } .rc-position-sticky { position: sticky !important; }
.rc-top-0 { top: 0 !important; } .rc-top-50 { top: 50% !important; } .rc-top-100 { top: 100% !important; }
.rc-bottom-0 { bottom: 0 !important; } .rc-bottom-50 { bottom: 50% !important; } .rc-bottom-100 { bottom: 100% !important; }
.rc-start-0 { left: 0 !important; } .rc-start-50 { left: 50% !important; } .rc-start-100 { left: 100% !important; }
.rc-end-0 { right: 0 !important; } .rc-end-50 { right: 50% !important; } .rc-end-100 { right: 100% !important; }
.rc-translate-middle { transform: translate(-50%, -50%) !important; }
.rc-pe-none { pointer-events: none !important; } .rc-pe-auto { pointer-events: auto !important; }
.rc-user-select-none { user-select: none !important; } .rc-user-select-all { user-select: all !important; } .rc-user-select-auto { user-select: auto !important; }
.rc-overflow-auto { overflow: auto !important; } .rc-overflow-hidden { overflow: hidden !important; } .rc-overflow-visible { overflow: visible !important; } .rc-overflow-scroll { overflow: scroll !important; }
.rc-opacity-0 { opacity: 0 !important; } .rc-opacity-25 { opacity: .25 !important; } .rc-opacity-50 { opacity: .5 !important; } .rc-opacity-75 { opacity: .75 !important; } .rc-opacity-100 { opacity: 1 !important; }
.rc-float-start { float: left !important; } .rc-float-end { float: right !important; } .rc-float-none { float: none !important; }
.rc-z-0 { z-index: 0 !important; } .rc-z-1 { z-index: 1 !important; } .rc-z-2 { z-index: 2 !important; } .rc-z-3 { z-index: 3 !important; }
.rc-cursor-pointer { cursor: pointer !important; }`);

// compact: comments (but the first) and spacing out; the readable source is src/styles/components.css and this file
const [head, ...rest] = out;
const compact = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ")
  .replace(/\s*([{};>])\s*/g, "$1").replace(/;}/g, "}").replace(/}/g, "}\n").trim();
const css = `${head}\n${rest.map(compact).join("\n")}\n`;
writeFileSync(join(src, "styles.css"), css);
console.log(`src/styles.css: ${(css.length / 1024).toFixed(1)} KB`);
