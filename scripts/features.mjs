// Feature tests (run after a build: node scripts/features.mjs):
//   1. schema shorthands: a single child as an object, optional ids (normalizeSchema)
//   2. entry points: rcube-html/core alone, then rcube-html/chart adds the Chart to the SAME registry; CommonJS too
//   3. the Calendar's event editor makes a repeating event (Repeat section)
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const dom = new JSDOM("<!doctype html><html><head></head><body><div id=root></div></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
for (const k of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "HTMLSelectElement", "Element", "Node", "MouseEvent", "KeyboardEvent", "Event", "CustomEvent", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"]) {
  const v = typeof dom.window[k] === "function" && /^[a-z]/.test(k) ? dom.window[k].bind(dom.window) : dom.window[k];
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const React = (await import("react")).default;
const { act } = await import("react");
const { renderToString } = await import("react-dom/server");
const { createRoot } = await import("react-dom/client");
const h = React.createElement;

// ---------------------------------------------------------------- 1. schema shorthands
const core = await import("../dist/core.js");
const { normalizeSchema, childrenOf, useDynamicTag, DynamicTag, ComponentRegistry } = core;

const n = normalizeSchema([
  { type: "row", children: { type: "column", children: { type: "InputField", props: { name: "email", label: "Email" } } } },
  { type: "row", id: "fixed", children: [
    { type: "column", children: [{ type: "P", props: { text: "one" } }, null, false, { type: "P", props: { text: "two" } }] },
    { type: "column", children: [{ type: "InputField", props: { name: "email" } }] },
  ] },
  { type: "Tabs", id: "tabs", items: [{ key: "a", title: "A", children: { type: "P", props: { text: "in a tab" } } }] },
  { type: "Modal", id: "m", children: { type: "P", props: { text: "body" } }, footer: { type: "ButtonField", props: { text: "OK" } } },
  { type: "row", id: "row1" }, // an id written by hand that a generated one would have taken
]);
assert.equal(n[0].id, "row1-2", "a generated id never takes one written by hand");
assert.ok(Array.isArray(n[0].children) && n[0].children.length === 1, "a single child becomes a list");
assert.equal(n[0].children[0].id, "row1-2-column1");
assert.equal(n[0].children[0].children[0].id, "email", "a field's id is its name");
assert.equal(n[1].id, "fixed", "ids written by hand are kept");
assert.deepEqual(n[1].children[0].children.map((c) => c.id), ["fixed-column1-p1", "fixed-column1-p2"], "empty entries are left out; siblings numbered by type");
assert.equal(n[1].children[1].children[0].id, "email-2", "a second field with the same name gets -2");
assert.equal(n[2].items[0].children[0].id, "tabs-a-p1", "items[].children: a single child, id from the tab's key");
assert.equal(n[3].footer[0].id, "m-footer-buttonfield1", "a Modal footer: a single child");
assert.deepEqual(childrenOf({ children: { type: "P" } }).length, 1);
assert.deepEqual(normalizeSchema(n), n, "a regular schema comes back the same");
console.log("schema shorthands: ok (single children, generated ids, ids kept, no clashes)");

// the form renders a schema written with the shorthands
function Short() {
  const form = useDynamicTag({ schema: [{ type: "row", children: { type: "column", children: { type: "InputField", props: { name: "email", label: "Email address" } } } }] });
  return h(DynamicTag, { form });
}
const shortHtml = renderToString(h(Short));
assert.match(shortHtml, /name="email"/);
assert.match(shortHtml, /Email address/);
console.log("form with shorthands: ok");

// ---------------------------------------------------------------- 2. entry points
assert.equal(ComponentRegistry.Chart, undefined, "rcube-html/core alone has no Chart");
function WithChart() {
  const form = useDynamicTag({ schema: [{ type: "Chart", id: "ch", props: { data: [{ label: "a", value: 1 }] } }] });
  return h(DynamicTag, { form });
}
assert.match(renderToString(h(WithChart)), /Chart isn.*t loaded: add import .*rcube-html\/chart/, "core alone says which import adds the Chart");
const chart = await import("../dist/chart.js");
assert.equal(ComponentRegistry.Chart, chart.Chart, "rcube-html/chart adds the Chart to core's registry (one registry)");
assert.doesNotMatch(renderToString(h(WithChart)), /t loaded: add import/, "the Chart renders once its entry point is imported");
const full = await import("../dist/index.js");
assert.equal(full.ComponentRegistry, ComponentRegistry, "rcube-html and rcube-html/core share one registry");
for (const name of ["DataTable", "DynamicTable", "Calendar", "Tree", "RichText", "RichTextField", "FileUploadField", "FileUpload"]) {
  assert.ok(ComponentRegistry[name], `rcube-html registers ${name}`);
}
const require = createRequire(import.meta.url);
const cjsCore = require("../dist/core.cjs");
assert.equal(cjsCore.ComponentRegistry.Calendar, undefined);
require("../dist/calendar.cjs");
assert.ok(cjsCore.ComponentRegistry.Calendar, "CommonJS: rcube-html/calendar adds the Calendar to core's registry");
assert.ok(require("../dist/index.cjs").DataTable, "CommonJS: rcube-html has everything");
console.log("entry points: ok (core alone, core + chart share one registry, everything in rcube-html, CommonJS)");

// ---------------------------------------------------------------- 3. Calendar: a repeating event from the editor
const created = [];
function Cal() {
  const form = useDynamicTag({
    schema: [{ type: "Calendar", id: "cal", props: { view: "week", date: "2026-11-16", events: [], onEventCreate: "created()" } }],
    actions: { created: (payload) => created.push(payload?.event) },
  });
  return h(DynamicTag, { form });
}
const root = createRoot(document.getElementById("root"));
await act(async () => { root.render(h(Cal)); });
const click = async (el) => act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
const setValue = async (el, value) => act(async () => {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new dom.window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
});
const byText = (sel, text) => [...document.querySelectorAll(sel)].find((el) => el.textContent.trim() === text);
await click([...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create")));
const title = document.querySelector('input[placeholder="Add title"]');
assert.ok(title, "the event editor opened");
await setValue(title, "Standup");
const repeat = document.getElementById("cal-repeat");
assert.ok(repeat, "the editor has a Repeat choice");
assert.equal(repeat.value, "", "a new event doesn't repeat");
await setValue(repeat, "weekly");
const days = [...document.querySelectorAll('[aria-label="On these days"] button')];
assert.equal(days.length, 7, "weekly: a button per weekday");
for (const label of ["Tue", "Thu"]) await click(days.find((b) => b.textContent === label));
await click(document.getElementById("cal-ends-count"));
const times = document.querySelector('input[aria-label="Number of times"]');
await setValue(times, "6");
await click(byText("button", "Save"));
assert.equal(created.length, 1, "the event was created");
const ev = created[0];
assert.equal(ev.title, "Standup");
assert.equal(ev.recurrence.freq, "weekly");
assert.equal(ev.recurrence.count, 6);
assert.ok(ev.recurrence.byDay.includes(2) && ev.recurrence.byDay.includes(4), `byDay holds Tue and Thu: ${JSON.stringify(ev.recurrence.byDay)}`);
await act(async () => { root.unmount(); });
console.log(`calendar repeat: ok (${JSON.stringify(ev.recurrence)})`);
