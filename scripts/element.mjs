// <rcube-form> tests (run after a build: node scripts/element.mjs):
//   1. the element from JSON in the page (as JSP / server pages write it): server markup replaced, actions from a
//      global object, unknown actions as rcube-action events, values, rcube-change, rcube-submit, el.api
//   2. properties set before the element is defined (Angular / Vue may do that), and mount() for plain JavaScript
//   3. the Vue wrapper: props, v-model both ways, submit
//   4. rcube-html/server: renderFormHtml writes the element, its JSON and the drawn form; the element takes it over
//   5. the <script> bundle (dist/browser/rcube-html.js) defines window.RcubeHtml and <rcube-form> on its own
import { JSDOM } from "jsdom";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/" });
for (const k of ["window", "document", "navigator", "HTMLElement", "HTMLInputElement", "Element", "Node", "MouseEvent", "Event", "CustomEvent", "customElements", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver", "SVGElement"]) {
  const v = typeof dom.window[k] === "function" && /^[a-z]/.test(k) ? dom.window[k].bind(dom.window) : dom.window[k];
  Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
}
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
const click = (el) => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
const type = (el, value) => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
};
const button = (root, text) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === text);

const schema = [
  { type: "row", children: { type: "column", children: [
    { type: "InputField", props: { name: "email", label: "Email", type: "email", required: true } },
    { type: "InputField", props: { name: "city", label: "City" } },
    { type: "ButtonField", props: { text: "Save", onClick: "save()" } },
    { type: "ButtonField", props: { text: "Other", onClick: "somethingElse()" } },
    { type: "ButtonField", props: { text: "Check", onClick: "runValidation()" } },
  ] } },
];

// ---------------------------------------------------------------- 1. from JSON in the page
const el = await import("../dist/element/core.js");
assert.ok(customElements.get("rcube-form"), "importing rcube-html/element/core defines <rcube-form>");

const saved = [];
window.pageActions = { save: (event, context, api) => saved.push(api.getFormEntries()[0]) };
const events = [];
const json = (part, value) => `<script type="application/json" data-rcube="${part}">${JSON.stringify(value).replace(/</g, "\\u003c")}</script>`;
const host = document.createElement("div");
host.innerHTML = `<rcube-form id="f1" actions="pageActions">${json("schema", schema)}${json("values", { city: "Leeds </script>" })}<p class="from-server">Loading…</p></rcube-form>`;
for (const name of ["rcube-ready", "rcube-change", "rcube-submit", "rcube-action"]) host.addEventListener(name, (e) => events.push([name, e.detail]));
document.body.appendChild(host);
await tick(10);
const f1 = document.getElementById("f1");
assert.ok(f1.querySelector('input[name="email"]'), "the form is drawn from the JSON in the page");
assert.equal(f1.querySelector(".from-server"), null, "markup that was in the element is replaced");
assert.equal(f1.querySelector("script"), null);
assert.equal(f1.querySelector('input[name="city"]').value, "Leeds </script>", "values from the page are filled in");
assert.ok(events.some(([name, d]) => name === "rcube-ready" && d.api), "rcube-ready with the api");
assert.equal(typeof f1.api.setFormData, "function", "el.api holds the form actions");

type(f1.querySelector('input[name="email"]'), "a@b.co");
await tick(10);
const change = events.filter(([name]) => name === "rcube-change").at(-1);
assert.equal(change?.[1].entries[0].email, "a@b.co", "rcube-change has the form's values");

click(button(f1, "Save"));
assert.deepEqual(saved.at(-1), { email: "a@b.co", city: "Leeds </script>" }, "an action from the global object named by actions=, with the api");
click(button(f1, "Other"));
const action = events.filter(([name]) => name === "rcube-action").at(-1);
assert.equal(action?.[1].name, "somethingElse", "an action nobody defined comes out as rcube-action");
assert.ok(action[1].api, "…with the api");
click(button(f1, "Check"));
await tick(10);
const submit = events.filter(([name]) => name === "rcube-submit").at(-1);
assert.equal(submit?.[1].values.email, "a@b.co", "runValidation() passing sends rcube-submit");

// a page that sets el.values from rcube-change doesn't go round in circles
let changes = 0;
f1.addEventListener("rcube-change", (e) => { changes++; f1.values = e.detail.entries[0]; });
type(f1.querySelector('input[name="city"]'), "York");
await tick(50);
assert.ok(changes <= 2, `rcube-change -> el.values doesn't loop (${changes} changes)`);
// a new values object is written into the fields
f1.values = { city: "Bath" };
await tick(10);
assert.equal(f1.querySelector('input[name="city"]').value, "Bath", "el.values = {…} fills the fields");
// el.actions (a property) wins over the global object
let own = 0;
f1.actions = { save: () => own++ };
await tick(10);
click(button(f1, "Save"));
assert.equal(own, 1, "el.actions = { … } is used");
f1.remove();
await tick(10);
console.log("element from page JSON: ok (drawn, values, actions, rcube-action / change / submit, api, no loops)");

// ---------------------------------------------------------------- 2. properties before the element is defined; mount()
const early = document.createElement("rcube-early");
early.schema = [{ type: "P", props: { text: "set before define" } }];
document.body.appendChild(early);
el.defineRcubeForm("rcube-early");
await tick(10);
assert.match(early.textContent, /set before define/, "a property set before the element was defined is used");
early.remove();

const target = document.createElement("div");
target.id = "target";
document.body.appendChild(target);
const got = [];
const mounted = el.mount("#target", { schema, actions: { save: () => got.push("save") }, onAction: (d) => got.push(d.name) });
await tick(10);
click(button(mounted, "Save"));
click(button(mounted, "Other"));
assert.deepEqual(got, ["save", "somethingElse"], "mount(): actions and onAction");
mounted.remove();
await tick(10);
console.log("element properties before define, mount(): ok");

// ---------------------------------------------------------------- 3. Vue
const { createApp, h, ref, nextTick } = await import("vue");
const { RcubeForm } = await import("../dist/element/vue.js");
const model = ref({ city: "Paris" });
const submitted = [];
const app = createApp({
  setup: () => () => h(RcubeForm, {
    schema,
    modelValue: model.value,
    "onUpdate:modelValue": (v) => { model.value = v; },
    onSubmit: (d) => submitted.push(d.values),
    actions: { save: () => {} },
  }),
});
const vueRoot = document.createElement("div");
document.body.appendChild(vueRoot);
app.mount(vueRoot);
await tick(20);
const vueForm = vueRoot.querySelector("rcube-form");
assert.ok(vueForm?.querySelector('input[name="email"]'), "Vue: the form is drawn");
assert.equal(vueForm.querySelector('input[name="city"]').value, "Paris", "Vue: v-model fills the fields");
type(vueForm.querySelector('input[name="email"]'), "v@ue.js");
await tick(20);
assert.equal(model.value?.email, "v@ue.js", "Vue: typing updates v-model");
model.value = { ...model.value, city: "Rome" };
await nextTick();
await tick(20);
assert.equal(vueForm.querySelector('input[name="city"]').value, "Rome", "Vue: a new v-model value fills the fields");
click(button(vueForm, "Check"));
await tick(20);
assert.equal(submitted.at(-1)?.email, "v@ue.js", "Vue: @submit");
app.unmount();
console.log("vue wrapper: ok (props, v-model both ways, submit)");

// ---------------------------------------------------------------- 4. rcube-html/server
const { renderFormHtml, jsonForScript } = await import("../dist/server.js");
assert.equal(jsonForScript({ a: "</script><b>" }), '{"a":"\\u003c/script>\\u003cb>"}');
const html = renderFormHtml({ schema, values: { city: "Oslo" } }, { attributes: { id: "ssr", actions: "pageActions", class: 'a"b' } });
assert.match(html, /^<rcube-form id="ssr" actions="pageActions" class="a&quot;b">/);
assert.match(html, /data-rcube="config"/);
assert.match(html, /<div data-rcube-ssr>.*name="email"/, "the form is drawn on the server");
const ssrBox = document.createElement("div");
ssrBox.innerHTML = html;
document.body.appendChild(ssrBox);
await tick(10);
const ssr = document.getElementById("ssr");
assert.equal(ssr.querySelector("[data-rcube-ssr]"), null, "the browser form replaces the drawn one");
assert.equal(ssr.querySelectorAll('input[name="email"]').length, 1);
assert.equal(ssr.querySelector('input[name="city"]').value, "Oslo", "values from the server are filled in");
ssr.remove();
console.log("server rendering: ok (element + JSON + drawn form, taken over in the browser)");

// ---------------------------------------------------------------- 5. the <script> bundle
for (const file of ["rcube-html.js", "rcube-html.core.js"]) {
  const page = new JSDOM(`<!doctype html><body><rcube-form id="s">${json("schema", schema)}</rcube-form></body>`, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
  page.window.eval(readFileSync(new URL(`../dist/browser/${file}`, import.meta.url), "utf8"));
  await tick(10);
  assert.equal(typeof page.window.RcubeHtml.mount, "function", `${file}: window.RcubeHtml`);
  assert.ok(page.window.RcubeHtml.React?.createElement, `${file}: React for components registered from the page`);
  assert.ok(page.window.document.querySelector('#s input[name="email"]'), `${file}: <rcube-form> already in the page is drawn`);
  assert.equal(!!page.window.RcubeHtml.ComponentRegistry.DataTable, file === "rcube-html.js", `${file}: DataTable only in the full bundle`);
  page.window.close();
}
console.log("browser script: ok (rcube-html.js, rcube-html.core.js)");

// ---------------------------------------------------------------- 6. types/element.d.ts names every export
const declared = new Set([...readFileSync(new URL("../types/element.d.ts", import.meta.url), "utf8").matchAll(/\b(?:function|const|interface)\s+(\w+)|(?:^|,)\s*(\w+): (?:any|string)/gm)].map((m) => m[1] || m[2]));
const all = await import("../dist/element/index.js");
const untyped = Object.keys(all).filter((name) => !declared.has(name));
assert.deepEqual(untyped, [], `types/element.d.ts is missing: ${untyped.join(", ")}`);
console.log(`types: ok (${Object.keys(all).length} exports declared)`);
process.exit(0);
