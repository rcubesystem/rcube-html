// Smoke test: renders a schema with every built-in component, on the server (HTML) and in a DOM (jsdom),
// and checks the markup is rcube-html's own (rc-*), with no Bootstrap classes. Run after a build: node scripts/smoke.mjs
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";

const dom = new JSDOM("<!doctype html><html><head></head><body><div id=root></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
for (const k of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "MouseEvent", "KeyboardEvent", "CustomEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  const v = typeof dom.window[k] === "function" && /^[a-z]/.test(k) ? dom.window[k].bind(dom.window) : dom.window[k];
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const { renderToString } = await import("react-dom/server");
const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const lib = await import("../dist/index.js");
const { useDynamicTag, DynamicTag } = lib;

const schema = [
  { type: "row", id: "r1", props: { gap: 3 }, children: [
    { type: "column", id: "c1", props: { span: { xs: 12, md: 6 } }, children: [
      { type: "InputField", id: "name", props: { name: "name", label: "Name", required: true, hint: "Your name" } },
      { type: "SelectField", id: "pick", props: { name: "pick", label: "Pick", options: ["A", "B"] } },
      { type: "TextareaField", id: "note", props: { name: "note", label: "Note" } },
      { type: "CheckboxGroupField", id: "cg", props: { name: "cg", label: "Topics", options: ["x", "y"], required: true } },
      { type: "RadioGroupField", id: "rg", props: { name: "rg", label: "One", options: ["a", "b"] } },
      { type: "SliderField", id: "sl", props: { name: "sl", label: "Level", min: 0, max: 10, defaultValue: 3 } },
      { type: "InputField", id: "ok", props: { name: "ok", type: "checkbox", label: "OK" } },
      { type: "ButtonField", id: "go", props: { text: "Go", type: "submit" } },
    ] },
    { type: "column", id: "c2", children: [
      { type: "Card", id: "card", props: { title: "Card", header: "H", footer: "F" }, children: [{ type: "P", id: "p", props: { text: "body" } }] },
      { type: "Alert", id: "al", props: { variant: "warning", heading: "Heads up", text: "t", dismissible: true } },
      { type: "Tabs", id: "tabs", items: [{ key: "a", title: "A", children: [{ type: "P", id: "ta", props: { text: "a" } }] }, { key: "b", title: "B", children: [] }] },
      { type: "Accordion", id: "acc", props: { defaultActiveKey: "a" }, items: [{ key: "a", title: "A", children: [] }, { key: "b", title: "B", children: [] }] },
      { type: "Modal", id: "m", props: { title: "M" }, children: [{ type: "P", id: "mp", props: { text: "in modal" } }] },
      { type: "Carousel", id: "car", items: [{ src: "a.png", caption: "1" }, { src: "b.png", caption: "2" }] },
      { type: "Tooltip", id: "tip", props: { text: "tip", label: "hover" } },
      { type: "Popover", id: "pop", props: { title: "P", text: "pop", label: "click" } },
      { type: "Badge", id: "b", props: { text: "New", bg: "success", pill: true } },
      { type: "Breadcrumb", id: "bc", props: { items: [{ text: "Home", href: "/" }, { text: "Here", active: true }] } },
      { type: "ProgressBar", id: "pb", props: { now: 40, showLabel: true, variant: "info", striped: true } },
      { type: "Spinner", id: "sp", props: {} },
      { type: "ListGroup", id: "lg", props: { items: [{ text: "one", badge: 2 }, { text: "two", href: "#", active: true }] } },
      { type: "IMG", id: "img", props: { src: "x.png" } },
    ] },
  ] },
  { type: "DataTable", id: "t", props: { title: "Orders", rowKey: "id", columnToggle: true, selectable: true, searchable: true, pageSize: 2, stackBelow: "md",
    columns: [{ key: "id", title: "#" }, { key: "s", title: "Status", badge: { paid: "success", due: "warning" } }],
    rows: [{ id: 1, s: "paid", _variant: "danger" }, { id: 2, s: "due" }, { id: 3, s: "paid" }] } },
  { type: "Tree", id: "tree", props: { nodes: [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }] } },
  { type: "Calendar", id: "cal", props: { events: [] } },
  { type: "Chart", id: "ch", props: { type: "bar", data: [{ label: "a", value: 1 }] } },
  { type: "FileUploadField", id: "up", props: { name: "up", label: "Files" } },
  { type: "RichTextField", id: "rt", props: { name: "rt", label: "Text" } },
];

function Page() {
  const form = useDynamicTag({ schema, actions: {}, onSubmit: () => {} });
  return React.createElement(DynamicTag, { form });
}

// 1. server
const html = renderToString(React.createElement(Page));
const classes = new Set([...html.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean));
const BOOTSTRAP = /^(btn|btn-.*|form-.*|table|table-.*|card|card-.*|modal.*|badge|bg-.*|text-.*|d-.*|m[tbsexy]?-\d|p[tbsexy]?-\d|gap-\d|row|col|col-.*|container|alert|alert-.*|nav|nav-.*|pagination|page-.*|dropdown.*|spinner-.*|progress|progress-bar|list-group.*|breadcrumb.*|accordion.*|carousel.*|visually-hidden|invalid-feedback|small|fw-.*|align-.*|justify-.*|flex-.*|w-100|h-100|position-.*|border|border-.*|rounded.*|shadow.*)$/;
const leftovers = [...classes].filter((c) => BOOTSTRAP.test(c));
assert.deepEqual(leftovers, [], `Bootstrap class names in the markup: ${leftovers.join(" ")}`);
for (const c of ["rc-row", "rc-col-12", "rc-col-md-6", "rc-g-3", "rc-input", "rc-select", "rc-check-input", "rc-range", "rc-btn", "rc-card", "rc-alert-warning", "rc-nav-tabs",
  "rc-accordion-button", "rc-modal", "rc-carousel", "rc-badge-success", "rc-breadcrumb", "rc-progress-bar", "rc-spinner-border", "rc-list-group-item", "rc-table", "rc-table-striped",
  "rc-table-danger", "rc-pagination", "rc-container", "rc-img-fluid"]) {
  assert.ok(classes.has(c), `missing ${c}`);
}
console.log(`server render: ok (${html.length} chars, ${classes.size} class names, no Bootstrap ones)`);

// 2. browser (jsdom): renders, the stylesheet goes into <head>, the column menu opens in <body>
const root = createRoot(document.getElementById("root"));
await act(async () => { root.render(React.createElement(Page)); });
assert.ok(document.getElementById("rcube-html-styles"), "the stylesheet was not added");
const toggle = document.querySelector(".rc-dropdown-toggle");
await act(async () => { toggle.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
assert.ok(document.body.querySelector(":scope > .rc-dropdown-menu"), "the column menu didn't open");
// Escape closes it
await act(async () => { document.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
assert.ok(!document.querySelector(".rc-dropdown-menu"), "Escape didn't close the column menu");
await act(async () => { root.unmount(); });
console.log("browser render: ok (stylesheet added, column menu opens and closes)");
