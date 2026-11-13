# rcube-html: An Open-Source, JSON-Driven HTML Page Renderer

rcube-html is a schema-driven form and layout engine. Describe rows, columns, fields and buttons as JSON-like objects, and it renders them — with built-in validation, conditional and dependent fields, input masks, repeatable entries, runtime changes and multi-language text. Use it natively in **React**, or as the `<rcube-form>` web component in **Angular, Vue, plain JavaScript, and server-rendered pages (JSP, PHP, .NET)**. Ships with its own components and stylesheet — no framework lock-in.

It works with any CSS framework — Bootstrap, Tailwind, a CMS theme, your own CSS or none — for building responsive pages.

**Live demo and tutorials: [rcube-html.com](https://rcube-html.com/)** — every component with a live example, the events it fires, and copy-ready schema and page code ([source](https://github.com/rcubesystem/rcube-html-examples)).

```bash
npm install rcube-html
```

Peer dependencies: `react` ≥ 18, `react-dom` ≥ 18 (for React apps; the `<rcube-form>` element brings its own React: see [Angular, Vue, plain JavaScript and server pages](#angular-vue-plain-javascript-and-server-pages)). Import the stylesheet once in your app:

```js
import 'rcube-html/styles.css';
```

Without it, rcube-html adds the same CSS to the page itself the first time it loads in the browser (importing it is better: it's in the page before anything draws).

Works in Next.js App Router (the bundle is marked `"use client"`).

## What's in the package

One npm package, `rcube-html`, holds everything:

| What | Where in rcube-html | How it's used |
|---|---|---|
| React library | `src/*.js` → `dist/index.js`, `dist/core.js`, … | `import … from "rcube-html"` |
| `<rcube-form>` element | `src/element.js`, `src/element/*.js` → `dist/element/` | `import "rcube-html/element"` |
| Vue wrapper | `src/element/vue.js` → `dist/element/vue.js` | `import { RcubeForm } from "rcube-html/vue"` |
| Script-tag bundles | `src/browser.js`, `src/browser-core.js` → `dist/browser/` | `<script src="…/rcube-html.js">` |
| Node server helper | `src/server.js` → `dist/server.js` | `import { renderFormHtml } from "rcube-html/server"` |
| Angular component | `integrations/angular/rcube-form.component.ts` | copied into the Angular app |
| JSP tag | `integrations/jsp/rcube-form.tag` | copied to `WEB-INF/tags/rcube/` |
| TypeScript types | `types/*.d.ts` | used by editors and TypeScript on their own |
| Tests | `scripts/smoke.mjs`, `features.mjs`, `element.mjs` | `npm test` |

## Get it

| You build with | Get rcube-html from | Then |
|---|---|---|
| React / Next.js | npm: `npm install rcube-html` | `import { useDynamicTag, DynamicTag } from "rcube-html"` |
| Angular | npm: `npm install rcube-html` | copy `integrations/angular/rcube-form.component.ts` into the app |
| Vue 3 | npm: `npm install rcube-html` | `import { RcubeForm } from "rcube-html/vue"` |
| Any bundler (Svelte, Lit, jQuery, …) | npm: `npm install rcube-html` | `import { mount } from "rcube-html/element"` |
| Plain HTML, PHP, .NET, Django, a CMS | the CDN — `https://cdn.jsdelivr.net/npm/rcube-html@0.8.0/dist/browser/rcube-html.js` (or unpkg.com) — or the files of `dist/browser/` copied to your static folder | `<script src="…/rcube-html.js">` |
| Java / JSP | the files of `dist/browser/` and `integrations/jsp/rcube-form.tag` copied into the web app — or, once it's deployed at [webjars.org](https://www.webjars.org/) (NPM tab), the Maven dependency `org.webjars.npm:rcube-html` | `<rc:rcube-form schemaFile="…">` |
| Node server pages | npm: `npm install rcube-html` | `renderFormHtml(…)` from `rcube-html/server` |

Starters with every example, one per framework (React, Angular, Vue, HTML, JSP), are in the
[examples repository](https://github.com/rcubesystem/rcube-html-examples).

## Styles and themes

rcube-html draws its own buttons, fields, tables, pager, dropdowns, dialogs, tabs and so on, with `rc-` classes (`rc-btn rc-btn-primary`, `rc-input`, `rc-table`, …), so it runs the same in any page: with Bootstrap, inside a CMS, or on its own.

**Colours, corners and sizes are CSS variables.** Set them on `:root` (or on any element, for one part of the page):

```css
:root {
  --rc-primary: #0b5fff;          --rc-primary-rgb: 11, 95, 255;
  --rc-danger: #da1414;           --rc-danger-rgb: 218, 20, 20;
  --rc-body-color: #272833;       --rc-body-bg: #fff;
  --rc-border-color: #e7e7ed;     --rc-border-radius: .25rem;
  --rc-font-size: .875rem;
}
```

The full list is at the top of `styles.css`: `--rc-{primary|secondary|success|info|warning|danger|light|dark}` (+ `-rgb`, `-text`, `-bg-subtle`, `-border-subtle`), `--rc-body-color`, `--rc-body-bg`, `--rc-emphasis-color`, `--rc-secondary-color`, `--rc-secondary-bg`, `--rc-tertiary-bg`, `--rc-border-color`, `--rc-border-width`, `--rc-border-radius` (`-sm`, `-lg`), `--rc-link-color`, `--rc-focus-ring`, `--rc-box-shadow`, `--rc-font-size`, and the layers `--rc-z-dropdown`, `--rc-z-modal`, `--rc-z-tooltip`.

- **With Bootstrap 5.3 on the page**, every variable follows Bootstrap's (`--rc-primary` is `var(--bs-primary)`), so an app's Bootstrap theme colours rcube-html too. Component tweaks a theme makes to Bootstrap's own classes (`.btn { padding }`, `.table > * > * { padding }`) need the same lines for `.rc-btn`, `.rc-table`, … — each component has variables for that (`--rc-btn-padding-x`, `--rc-btn-radius`, `--rc-table-hover-bg`, …).
- **In a CMS**, map the variables to the theme's once, in the theme or the site's own stylesheet:

  ```css
  :root {
    --rc-primary: var(--primary, #0b5fff);   --rc-primary-rgb: 11, 95, 255;
    --rc-body-color: var(--body-color, #272833);
    --rc-border-color: var(--gray-300, #e7e7ed);
    --rc-border-radius: var(--border-radius, .25rem);
  }
  ```

  The theme's own `.btn`, `.form-control`, `.table`, `.row`… never touch rcube-html (it uses none of them), and rcube-html's classes never touch the theme's.
- **Dark:** `data-rc-theme="dark"` (or Bootstrap's `data-bs-theme="dark"`) on `<html>` or any element.

**Classes for schemas.** Every node takes `props.className` and `props.style`. rcube-html's utility classes carry Bootstrap's names with `rc-` in front: `rc-d-flex`, `rc-d-md-none`, `rc-gap-2`, `rc-mt-3`, `rc-p-2`, `rc-text-center`, `rc-text-muted`, `rc-small`, `rc-fw-semibold`, `rc-border`, `rc-rounded`, `rc-bg-body-tertiary`, `rc-w-100`, `rc-col-md-6`, … On a page with Bootstrap its classes work in schemas too — but only there.

**Your own components** (registerComponent) can use rcube-html's building blocks, which take react-bootstrap's props: `Button`, `ButtonGroup`, `CloseButton`, `Form` (`Form.Group`, `Form.Label`, `Form.Control`, `Form.Select`, `Form.Check`, `Form.Text`, `Form.Range`), `Table`, `Pagination`, `Dropdown`, `Image`, `Container`, `Row`, `Col`, `UiModal`, `UiCard`, `UiBadge`, `UiSpinner`, `UiProgressBar`, `Overlay` and `cx` (joins class names).

### Upgrading from 0.6 (Bootstrap)

- Remove `react-bootstrap` / `bootstrap` if only rcube-html needed them, and add `import 'rcube-html/styles.css'`.
- A page that keeps Bootstrap for itself: schema `className`s with Bootstrap classes keep working; for schemas that must also render without Bootstrap, use `rc-` classes and the layout props (`span`, `gap`).
- CSS you wrote against rcube-html's markup (`.table`, `.btn`, `.form-control`, `.pagination` inside its components) now targets `.rc-table`, `.rc-btn`, `.rc-input`, `.rc-pagination`, …; inline `--bs-table-bg-state` is `--rc-table-bg-state`.
- Don't give your own elements class names rcube-html uses (`rc-card-body`, `rc-progress`, `rc-table-…`): pick another prefix.

## Quick start

Live demo: [rcube-html.com](https://rcube-html.com/)

```jsx
"use client";
import { useDynamicTag, DynamicTag } from 'rcube-html';

const schema = [
  { type: 'row', id: 'row-name', children: [
    { type: 'column', id: 'c1', children: [
      { type: 'InputField', id: 'first', props: { name: 'firstName', label: 'First Name', required: true, uppercase: true } },
    ] },
    { type: 'column', id: 'c2', children: [
      { type: 'InputField', id: 'email', props: { type: 'email', name: 'email', label: 'Email', required: true, lowercase: true,
        pattern: '[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}', patternMessage: 'Please enter a valid email address.' } },
    ] },
  ] },
];

const buttons = [
  { type: 'row', id: 'row-buttons', children: [
    { type: 'column', id: 'cb', props: { className: 'rc-d-flex rc-justify-content-end rc-gap-2' }, children: [
      { type: 'ButtonField', id: 'clear', props: { text: 'Clear', onClick: 'clearForm()' } },
      { type: 'ButtonField', id: 'submit', props: { type: 'submit', text: 'Submit', onClick: 'runValidation()' } },
    ] },
  ] },
];

export default function SignUp() {
  const form = useDynamicTag({
    schema,
    buttons,
    onSubmit: (entries) => console.log(entries), // [{ firstName: "JANE", email: "jane@example.com" }]
  });
  return <DynamicTag form={form} />;
}
```

## Entry points: load only what you use

`rcube-html` is everything. A page that needs only some of it imports `rcube-html/core` and the parts it uses:

| Import | Adds | About (gzipped) |
|---|---|---|
| `rcube-html` | everything | 118 KB |
| `rcube-html/core` | forms, fields, layout, containers, display, actions, languages, styles | 51 KB |
| `rcube-html/table` | `DataTable` / `DynamicTable` | +9 KB on core |
| `rcube-html/chart` | `Chart` | +12 KB on core |
| `rcube-html/calendar` | `Calendar` | +16 KB on core |
| `rcube-html/tree` | `Tree` (file explorer) | |
| `rcube-html/richtext` | `RichText`, `RichTextField` | |
| `rcube-html/upload` | `FileUploadField` / `FileUpload` | |

```js
import { useDynamicTag, DynamicTag } from 'rcube-html/core';
import 'rcube-html/table';              // DataTable can now be used in schemas (it is also exported: import { DataTable } …)
```

Each entry point adds its components to schemas when it is imported, and they all share one copy of the core (one
component registry, one language context). A schema that uses a component whose entry point the page didn't import
shows *"Chart isn't loaded: add import "rcube-html/chart" to this page"* where it would be. Pages that import
`rcube-html` need no change.

## Angular, Vue, plain JavaScript and server pages

The same schemas work outside React through **`<rcube-form>`**, a web component with React inside it (the page
doesn't install React). One schema JSON file can serve a React app, an Angular app, a Vue app and a JSP page.

| Where | Use | File |
|---|---|---|
| Angular 14+ | `<rcube-html-form>` component: inputs, outputs, `formControl` / `ngModel` / `[(values)]` | `integrations/angular/rcube-form.component.ts` (copy into the app) |
| Vue 3 | `<RcubeForm>` with `v-model` | `import { RcubeForm } from "rcube-html/vue"` |
| Any bundler (Svelte, Lit, jQuery, …) | `<rcube-form>` or `mount("#id", { … })` | `import "rcube-html/element"` |
| No bundler: JSP, PHP, ASP.NET, Django, CMS pages | one `<script>`, the schema as JSON in the page | `dist/browser/rcube-html.js` (`rcube-html.core.js`: forms only) |
| JSP | `<rc:rcube-form schemaFile="/WEB-INF/schemas/signup.json">` | `integrations/jsp/rcube-form.tag` |
| Node servers | `renderFormHtml(options)`: the element with the form already drawn | `import { renderFormHtml } from "rcube-html/server"` |

Sizes (gzipped, React and styles included): `rcube-html/element` (everything) about 162 KB, `rcube-html/element/core`
(forms) about 111 KB. As with the React entry points, `rcube-html/element/core` plus `rcube-html/element/table`,
`/chart`, `/calendar`, `/tree`, `/richtext`, `/upload` load only what a page uses.

### The element

```html
<rcube-form id="signup" actions="signupActions" schema-src="/schemas/signup.json"></rcube-form>

<!-- or the options as JSON in the page (what a server page writes) -->
<rcube-form id="signup" actions="signupActions">
  <script type="application/json" data-rcube="schema">[ … ]</script>
  <script type="application/json" data-rcube="values">{ "email": "a@b.co" }</script>
  <p>Loading…</p>   <!-- anything here stays until the form replaces it -->
</rcube-form>
```

- **Options** — properties: `schema`, `buttons`, `actions`, `messages`, `languages`, `language`, `data`, `repeatable`,
  `values`. Each new value draws the form again (give a new array/object rather than changing one in place). In the
  page: `<script type="application/json" data-rcube="schema | buttons | values | messages | languages | data">`, or
  `data-rcube="config"` with `{ "schema": …, "buttons": …, … }`. Attributes: `schema-src` (a schema or a config to
  fetch), `actions`, `language`, `repeatable`.
- **Actions** the schema names (`"onClick": "save()"`) are found in this order: built-in actions, `el.actions`
  (an object, or `(api) => object`), the global object named by the `actions` attribute (each called as
  `(event, context, api)`), and otherwise an `rcube-action` event.
- **Events** (`event.detail`): `rcube-ready` `{ api }`, `rcube-change` `{ values, entries }`, `rcube-submit`
  `{ entries, values }` (after `runValidation()` passes), `rcube-action` `{ name, event, context, api }`,
  `rcube-error` `{ error }` (`schema-src` failed).
- **`el.api`**: every form action — `setFormData`, `getFormEntries`, `runValidation`, `setNodeProps`, `hideNode`, ….

```js
import { mount } from "rcube-html/element";        // or window.RcubeHtml.mount with the <script>
const form = mount("#signup", {
  schema,
  actions: { checkEmail: (event, context) => { /* … */ } },
  onSubmit: ({ values }) => fetch("/api/signup", { method: "POST", body: JSON.stringify(values) }),
  onAction: ({ name, api }) => console.log("not defined:", name),
});
form.api.setFormData({ email: "a@b.co" });
```

### Angular

Copy `node_modules/rcube-html/integrations/angular/rcube-form.component.ts` into the app (Angular compiles components
from the app's own source), then:

```ts
@Component({
  standalone: true,
  imports: [RcubeFormComponent, ReactiveFormsModule],
  template: `<rcube-html-form [schema]="schema" [actions]="actions" [formControl]="signup"
               (submitted)="save($event.values)" (action)="onAction($event)"></rcube-html-form>`,
})
export class SignupComponent {
  schema = signupSchema;                          // the same JSON the other apps use
  signup = new FormControl({ email: "" });
  actions = { checkEmail: () => { /* … */ } };
  @ViewChild(RcubeFormComponent) form!: RcubeFormComponent;   // this.form.api.setNodeProps(…)
}
```

Outputs: `submitted`, `valuesChange` (so `[(values)]` works), `formChange`, `action`, `ready`. Add
`import "rcube-html/element/table";` (etc.) to `main.ts` when a schema uses those components.

### Vue 3

```vue
<script setup>
import { ref } from "vue";
import { RcubeForm } from "rcube-html/vue";
import "rcube-html/element/table";               // only if the schema has a DataTable
const values = ref({ email: "" });
const form = ref();                              // form.value.api.setNodeProps(…)
</script>
<template>
  <RcubeForm ref="form" :schema="schema" :actions="actions" v-model="values" @submit="save" @action="onAction" />
</template>
```

Events: `update:modelValue`, `change`, `submit`, `action`, `ready`, `error`.

### Server pages (JSP, PHP, .NET, …)

Write the element with its options as JSON, and load the script once:

```jsp
<%@ taglib prefix="rc" tagdir="/WEB-INF/tags/rcube" %>
<rc:rcube-form id="signup" schemaFile="/WEB-INF/schemas/signup.json" values="${signupJson}" actions="signupActions">
  <p>Loading the form…</p>
</rc:rcube-form>
<script src="${pageContext.request.contextPath}/static/rcube-html/rcube-html.js"></script>
<script>
  window.signupActions = {
    save: function (event, context, api) {
      var entries = api.runValidation();
      if (entries) fetch("signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entries[0]) });
    }
  };
</script>
```

The tag (`integrations/jsp/rcube-form.tag`, Java 9+) goes in `WEB-INF/tags/rcube/`; its header lists the
attributes. Other servers write the same markup: `<rcube-form>` and `<script type="application/json"
data-rcube="schema">` with `</` written as `<\/` inside the JSON.

Node servers can draw the form too, so it shows before the script runs:

```js
import { renderFormHtml } from "rcube-html/server";
const html = renderFormHtml({ schema, values }, { attributes: { id: "signup", actions: "signupActions" } });
```

The browser form replaces the drawn one when the script starts (text typed before that is not kept).

## Schema nodes

Live demo: [rcube-html.com/schema-basics](https://rcube-html.com/schema-basics)

Every node has a unique `id`. Layout nodes have `children`; component nodes have `props`.

**Shorthands.** Two things are optional, and the form makes the schema regular when it gets it (`normalizeSchema`):

- **A single child can be an object** instead of a one-item list, in `children`, `items[].children` and `footer`. Empty
  entries (`null`, `false`) are left out, so `cond && node` works inside a list.
- **The `id` is optional.** A field (any node with `props.name`) gets its name (`"email"`, then `"email-2"` if taken);
  any other node gets its parent's id, its type and its place among its siblings: `row1`, `row1-column2`,
  `row1-column2-p1`, `tabs-a-p1` (a tab's key), `m-footer-buttonfield1`. Ids you write are kept and never given to
  another node. Write the id yourself on a node your code changes (`setNodeProps`, `hideNode`, …) when the schema
  around it may change: a generated id follows the node's place.

```js
// the same form as the long version: no ids, single children as objects
const schema = [
  { type: 'row', children: { type: 'column', children: { type: 'InputField', props: { name: 'email', label: 'Email', required: true } } } },
];
```

Code that walks a schema itself can read children the same way with `childrenOf(node)` (always a list), or make a
whole schema regular first with `normalizeSchema(schema)`. Arrays and explicit ids keep working exactly as before.

| `type` | Renders | Notes |
|---|---|---|
| `row` | A 12-column grid row (top-level rows are wrapped in a container) | `props.gap` (0–5, or `{ x, y }`), `props.className` |
| `column` | A column: equal widths, or `props.span` (`6`, `"auto"`, `{ xs: 12, md: 6, lg: 4 }`) | `props.span`, `props.className` |
| `InputField` | `<input>` — text, email, password, number, date, tel, checkbox, radio, color, range, … | `props.type` |
| `TextareaField` | `<textarea>` | `rows` (default 4) |
| `SelectField` | `<select>` | `options`, `optionsFrom`, `placeholder` |
| `RadioGroupField` | One choice from `options` | `inline` (default true) |
| `CheckboxGroupField` | Any number of `options`; value is an array | `requiredOptions` |
| `SliderField` | Range slider showing its value | `min`, `max`, `step`, `defaultValue`, `showValue`, `valueSuffix` |
| `RichTextField` | Rich text editor; value is cleaned HTML | `toolbar`, `source`, `maxLength` — see [Rich text](#rich-text) |
| `RichText` | Shows rich text safely | `html`, `emptyText` |
| `ButtonField` | `<button>` (`rc-btn`) | `text`, `variant`, `size`, `onClick` |
| `Text` | Any of h1–h6, p, span, small, strong, em, label, blockquote | `tag`, `text` |
| `H1`…`H6`, `P`, `SPAN`, `SMALL`, `STRONG`, `EM`, `LABEL`, `BLOCKQUOTE` | Shortcuts for `Text` | `text` |
| `A`, `IMG`, `DIV`, `LIST` | Link, responsive image, div, list (`items`) | |
| `Badge` | Badge | `text`, `bg`, `pill`, `textColor` |
| `Breadcrumb` | Breadcrumb trail | `items: [{ text, href, active }]` |
| `ProgressBar` | Progress bar | `now`, `min`, `max`, `showLabel`, `variant`, `striped`, `animated` |
| `Spinner` | Loading spinner | `animation` (`border` / `grow`), `variant`, `size`, `text` |
| `ListGroup` | List group | `items: [{ text, href, active, disabled, variant, badge }]`, `flush`, `numbered`, `horizontal` |
| `Card`, `Accordion`, `Tabs`, `Modal` / `Dialog`, `Carousel`, `Tooltip`, `Popover`, `Alert` | Containers — hold other nodes, including fields | see [Containers](#containers) |
| `DataTable` / `DynamicTable` | Table with paging, sorting, search, selection, editable cells, spans, totals, export | see [DataTable](#datatable) |

`{ type: 'component', componentName: 'InputField' }` is also accepted.

`options` can be strings (`["Yes", "No"]`) or `{ label, value }` objects.

## Containers

Live demo: [rcube-html.com/cards-alerts](https://rcube-html.com/cards-alerts) · [tabs & accordion](https://rcube-html.com/tabs-accordion) · [modal & carousel](https://rcube-html.com/modal-carousel)

Containers render other schema nodes — text, buttons, rows and **form fields** — which keep validation, values, events and translation. Nested nodes go in `children`, in `items[].children` (one list per tab / panel / slide), or in `footer` (Modal).

```js
// Tabs — all tabs stay mounted, so values are kept and every tab is validated.
// A failed Submit opens the tab that holds the first error.
{ type: 'Tabs', id: 'profile', props: { defaultActiveKey: 'personal', variant: 'tabs' }, items: [
  { key: 'personal', title: 'Personal', children: [ /* nodes */ ] },
  { key: 'address',  title: 'Address',  children: [ /* nodes */ ] },
] }

// Accordion — same idea; "alwaysOpen": true allows several open panels
{ type: 'Accordion', id: 'faq', props: { defaultActiveKey: 'a', alwaysOpen: false, flush: false }, items: [
  { key: 'a', title: 'Shipping', children: [ /* nodes */ ] },
] }

// Modal (also "Dialog") — stays in the page while closed so fields keep their values;
// fields in a closed modal are not validated
{ type: 'Modal', id: 'edit', props: { title: 'Edit', show: false, size: 'lg', centered: true, backdrop: true },
  children: [ /* body nodes */ ],
  footer:   [ { type: 'ButtonField', id: 'done', props: { text: 'Done', 'data-modal': 'edit', onClick: 'closeModal()' } } ] }
{ type: 'ButtonField', id: 'open', props: { text: 'Edit', 'data-modal': 'edit', onClick: 'openModal()' } }

// Carousel — image slides and / or node slides; "interval": null stops auto-play
{ type: 'Carousel', id: 'hero', props: { interval: 5000 }, items: [
  { src: '/img/1.jpg', alt: 'One', caption: 'Title', text: 'Subtitle' },
  { children: [ /* nodes */ ] },
] }

// Tooltip / Popover — around any nodes ("wrapperClassName": "rc-d-block" for a full-width field)
{ type: 'Tooltip', id: 'tip', props: { text: 'Your legal name', placement: 'top' }, children: [ /* nodes */ ] }
{ type: 'Popover', id: 'pop', props: { title: 'Help', text: '...', trigger: 'click' }, children: [ /* nodes */ ] }

// Alert — "dismissible" hides the node; actions.showNode('notice') shows it again
{ type: 'Alert', id: 'notice', props: { variant: 'warning', heading: 'Note', text: '...', dismissible: true } }

// Card — title / content / header / footer / imgSrc, plus optional child nodes in the body
{ type: 'Card', id: 'c1', props: { header: 'Profile', title: 'Jane' }, children: [ /* nodes */ ] }
```

Tabs and Accordion `onSelect` events receive `{ eventKey }`; Modal `onHide` and Alert `onClose` run when they close themselves.

## DataTable

Live demo: [rcube-html.com/data-table](https://rcube-html.com/data-table) · [editable table & row actions](https://rcube-html.com/table-editing)

A schema-driven table (also registered as `DynamicTable`) with pagination, sorting, search, selection, editable cells, header groups, row / column spans, totals, CSV export and responsive views.

```js
{ type: 'DataTable', id: 'orders', props: {
  name: 'orders',            // submit rows under this key (omit for display-only tables)
  rowKey: 'id',              // stable row identity for selection / editing (default: internal id)
  title: 'Orders',
  columns: [
    { key: 'id', title: '#', sortable: true, width: 60 },
    { title: 'Customer', children: [                         // header group (colSpan)
      { key: 'name', title: '@orders.name', sortable: true },
      { key: 'email', title: 'Email', hideBelow: 'md', link: 'mailto:{email}' },
    ] },
    { key: 'region', title: 'Region', mergeSame: true },     // merge equal consecutive values (rowSpan)
    { key: 'status', title: 'Status', badge: { Paid: 'success', Due: 'warning', default: 'secondary' } },
    { key: 'amount', title: 'Amount', format: 'currency', currency: 'USD', align: 'end', total: 'sum' },
    { key: 'qty', title: 'Qty', total: 'sum',
      editor: { type: 'number', required: true, min: 1, max: 99 } },          // editable + validated
    { key: 'ship', title: 'Ship via', editor: { type: 'select', options: ['Air', 'Sea'] } },
  ],
  rows: [ { id: 1, name: 'Ann', email: 'ann@x.com', region: 'East', status: 'Paid', amount: 120, qty: 2, ship: 'Air' } ],
  pageSize: 10, pageSizeOptions: [10, 25, 50],
  sortable: false, searchable: true, selectable: true, removable: true, addable: true,   // selectable: 'single' = a radio per row (one at a time; clicking a row picks it)
  exportable: true, columnToggle: true,
  stackBelow: 'md',          // card view below md
  responsive: true, stickyHeader: false, maxHeight: 400,
  striped: true, bordered: false, hover: true, size: 'sm',
  onRowClick: 'openOrder()', onCellChange: 'orderChanged()', onSelectionChange: 'selectionChanged()',
} }
```

**Column options**

| Option | Effect |
|---|---|
| `key`, `title`, `width`, `align` (`start` / `center` / `end`) | Basics; `title` may be an `@key` |
| `children` | Header group over these columns |
| `sortable` | Click the header to sort (or set `sortable` on the table for all columns) |
| `hidden` | Hidden at first (column chooser / `showColumn` reveal it) |
| `hideBelow` (`sm` … `xxl`) | Hide the column on smaller screens |
| `hideInCards` | Leave out of the small-screen card view |
| `format` | `number`, `currency` (`currency`, `locale`), `percent`, `date`, `boolean`; `decimals` |
| `template`, `link`, `linkTarget` | `"{first} {last}"` text; link href with `{field}` placeholders |
| `badge` | `{ value: 'colour', default: '...' }` — primary, secondary, success, danger, warning, info, light, dark |
| `render` | `(value, row) => ReactNode` (for schemas written in code) |
| `editor` | Editable cell: `type` (`text`, `number`, `date`, `email`, `select` + `options`, `checkbox`, …), `placeholder`, `mask`, `uppercase`, and validation rules `required`, `pattern`, `min`, `max`, `allowedValues` with `*Message` overrides |
| `total` | Footer aggregate: `sum`, `avg`, `min`, `max`, `count` (over all filtered rows); label via `totalLabel` |
| `mergeSame` | Merge consecutive equal values into one cell (rowSpan) |
| `defaultValue` | Value for new rows |

**Colors and hover** — every color option takes a *look*: `{ variant, background, color, className, style }`.
`variant` is a table colour (`primary`, `secondary`, `success`, `danger`, `warning`, `info`, `light`, `dark`, `active`); `background` / `color` take any CSS color and are drawn through the table's variables (`--rc-table-bg-state`, `--rc-table-color-state`), so they show over striped rows.

```js
{ type: 'DataTable', id: 'orders', props: {
  columns: [
    { key: 'name', title: 'Name', headerLook: { variant: 'dark' } },          // header cell
    { key: 'amount', title: 'Amount', look: { variant: 'info' },              // whole column
      cellRules: [ { when: { gt: 1000 }, background: '#ffe5e5', color: '#b00020' } ] },  // cells by value
  ],
  rows: [
    { id: 1, name: 'Ann', amount: 50, _variant: 'warning' },                  // one specific row
    { id: 2, name: 'Bob', amount: 900, _look: { background: '#e7f1ff', className: 'rc-fw-bold' } },
  ],
  rowRules: [ { when: { field: 'status', equals: 'Overdue' }, variant: 'danger' } ],  // rows by value
  hoverRow:    { background: '#fff8e1' },                 // mouse over a row
  hoverColumn: { variant: 'primary' },                    // mouse over a cell / header → its column
  hoverCell:   { background: '#ffd54f', className: 'rc-fw-semibold' },
  selectedLook: { variant: 'active' },                    // selected rows (default)
} }
```

Conditions (`when`): `field` (defaults to the column for `cellRules`), `equals`, `notEquals`, `in`, `notIn`, `gt`, `gte`, `lt`, `lte`, `contains`, `empty`. When several looks apply, later ones win: row → column → cell rules → selected → hover row → hover column → hover cell. Setting `hoverRow` turns off the table's default grey row hover.

Change colors at runtime: `updateRow(id, key, { _variant: 'success' })`, `updateColumn(id, 'amount', { look: { background: '#e8f5e9' } })`, or `setNodeProps(id, { rowRules: [...], hoverRow: {...} })`.

**Row / column spans** — besides `mergeSame` and header groups, any row can set explicit spans:
`{ time: '9:00', mon: 'Math', _spans: { mon: { rowSpan: 2 }, tue: { colSpan: 2 } } }`.

**Editable cells** are validated on Submit like other fields. A failed Submit opens the tab / panel holding the table, moves to the page with the first error and focuses that cell. Errors are keyed `"<name>.<rowKey>.<column>"`.

**Actions** (all take the table's `id`):

| Method | Description |
|---|---|
| `getRows(id)` / `setRows(id, rows)` | Read / replace rows (`setFormData({ orders: [...] })` also works) |
| `addRow(id, row?, position?)` / `removeRow(id, keyOrIndex)` / `updateRow(id, keyOrIndex, patch)` | Row changes (`keyOrIndex`: rowKey value as string, or index as number) |
| `addColumn(id, column, position?)` / `removeColumn(id, key)` / `updateColumn(id, key, patch)` / `setColumns(id, columns)` | Column changes |
| `showColumn` / `hideColumn` / `toggleColumn(id, key)` | Column visibility |
| `selectRows(id, keys)` / `clearSelection(id)` / `getSelectedRows(id)` / `removeSelectedRows(id)` | Selection |

| `setPageRows(id, { rows, totalRows, page })` / `setTableLoading(id, loading)` | Server paging: show the server's page (ends loading) / show or end the loading spinner |

**Events** — `onRowClick` → `{ row, rowKey }`, `onCellChange` → `{ row, rowKey, column, value }`, `onSelectionChange` → `{ selected, rows }`, `onPageChange` → `{ page, pageSize }`, `onSortChange` → `{ sort }`, `onQueryChange` → `{ page, pageSize, sort, query }` (server paging), `onSearchChange` → `{ query }` (server paging).

**Server paging** — for large lists the server pages, sorts and searches, and the table holds only the page shown:

```js
{ type: 'DataTable', id: 'students', props: {
  serverSide: true, rows: firstPage.rows, totalRows: firstPage.total, page: 1,   // the first page, loaded with the page
  pageSize: 25, pageSizeOptions: [25, 50, 100], searchable: true, searchDelay: 350,
  onQueryChange: 'loadPage()',                                                    // page, rows per page, sort, search
  columns: [ { key: 'name', title: 'Name', sortable: true }, /* ... */ ],
} }

// actions
loadPage: async ({ page, pageSize, sort, query }) => {            // the table shows its spinner already
  const r = await fetch(`/api/students?page=${page}&pageSize=${pageSize}&q=${encodeURIComponent(query)}&sort=${sort?.key || ''}&dir=${sort?.dir || ''}`).then((x) => x.json());
  actions.setPageRows('students', { rows: r.students, totalRows: r.total, page: r.page });
},
```

**The chosen row** — selected, or in a table without selection the row last clicked (`onRowClick`; `highlightClicked: false` turns that off) — is highlighted: tinted, bold, with a bar at its start. Set the colours once for the app with `configureTableLook({ background, color, weight, accent })` (CSS values; or the `--rc-table-selected-bg`, `-color`, `-weight`, `-accent` CSS variables), or for one table with `selectedLook: { background, color }` / `{ variant: 'warning' }`.

With `selectable: 'single'` each row has a radio button (one row at a time; clicking a row picks it) — handy with `toolbarActions` that act on the chosen row (`needsSelection: true`). Clicking page 3 from page 1 asks for page 3 only. While a page is loading, the previous rows stay dimmed under a spinner and the pager, rows-per-page and sorting wait; if the call fails, call `setTableLoading(id, false)`: the spinner ends and the pager goes back to the page shown. `onQueryChange` runs as a form action, so the payload is its first argument.

**Action buttons** — like form buttons, `onClick` names an action (`"editOrder()"`), called as `fn(event, context)`:

```js
{ type: 'DataTable', id: 'orders', props: {
  columns: [
    { key: 'id', title: '#' },
    { key: 'actions', title: 'Actions', actions: [                       // buttons in every row
      { text: 'Edit', onClick: 'editOrder()' },
      { text: 'Delete', variant: 'outline-danger', onClick: 'deleteOrder()',
        disabledWhen: { field: 'status', equals: 'Paid' } },              // or hiddenWhen
    ] },
  ],
  toolbarActions: [                                                      // buttons in the toolbar
    { text: 'Approve', variant: 'success', onClick: 'approveOrders()', needsSelection: true },
  ],
} }

// useDynamicTag({ actions: (api) => ({
//   editOrder:     (event, { table, row, rowKey }) => api.updateRow(table, rowKey, { status: 'Editing' }),
//   deleteOrder:   (event, { table, rowKey }) => api.removeRow(table, rowKey),
//   approveOrders: (event, { table, selected, rows }) => selected.forEach((key) => api.updateRow(table, key, { status: 'Approved' })),
// }) })
```

Row context: `{ table, name, row, rowKey }`; toolbar context: `{ table, name, selected, rows }` (selected rows). Button options: `text`, `variant`, `className`, `title`, `onClick`, `hiddenWhen` / `disabledWhen` (row conditions, see above), `needsSelection` (toolbar). Action columns are not sorted or exported.

Tables with a `name` add their rows to submitted entries: `[{ firstName: 'JANE', orders: [{ id: 1, qty: 2, ... }] }]`.

## Chart

Live demo: [rcube-html.com/charts](https://rcube-html.com/charts)

An SVG chart (no chart library): bar, line, area, pie, donut and scatter, with tooltips, hover, highlight, rulers, animation, and data that changes at runtime from form events and buttons.

```js
{ type: 'Chart', id: 'sales', props: {
  chartType: 'bar',            // bar | line | area | pie | donut | scatter
  horizontal: false, stacked: false,
  title: 'Monthly sales', subtitle: 'USD', height: 300,
  labels: ['Jan', 'Feb', 'Mar'],
  series: [
    { key: 'online', name: 'Online', data: [42000, 51000, 38000] },
    { key: 'target', name: 'Target', type: 'line', dashed: true, data: [45000, 48000, 50000] },  // combo
  ],
  format: 'currency', currency: 'USD', decimals: 0,     // values (tooltip, labels, table)
  yAxis: { title: 'Revenue', min: 0, max: 100000, ticks: 5 }, xAxis: { title: 'Month' },
  grid: true,                                            // or { value: true, category: true }
  rulers: [ { value: 60000, label: 'Goal', showValue: true, labelAt: 'end' } ],   // { axis: 'x', label: 'Feb' } for a vertical one
  bands: [ { from: 0, to: 30000, label: 'Low' } ],       // shaded value ranges
  dataLabels: 'last',          // false | 'all' | 'last' | 'max' | 'minmax' (pie: true = %, 'value')
  legend: 'top', legendToggle: true, tooltip: true, crosshair: true, tableToggle: true,
  animate: true, animationDuration: 600,
  hover: 'fade',               // fade | lighten | none;  hoverColor: '#ffb000'
  highlight: { series: 'online', index: 2 }, highlightColor: '#0ca30c',   // or { label: 'Mar' }, or an array
  pointRules: [ { when: { lt: 32000 }, color: '#d03b3b' } ],              // colors by value
  onPointClick: 'pointClicked()', onPointHover: 'pointHovered()', onLegendClick: 'legendClicked()',
} }
```

- **Data**: cartesian series take `data: [numbers]` matching `labels`; pie / donut use the first series with `labels` as slices; scatter takes `data: [{ x, y, label, size }]`.
- **Series options**: `key`, `name`, `color`, `type` (`bar` / `line` / `area` within a bar chart), `dashed`, `strokeWidth`.
- **Options**: `smooth`, `markers`, `areaOpacity`, `barWidth` (default 24), `innerRadius` (donut, 0.6), `centerText`, `colors` (array overriding the palette), `emptyText`.
- `yAxis` is always the value axis and `xAxis` the category axis (also when `horizontal`); each takes `title`, `show`, `min`, `max`, `ticks`, `format`, `currency`. Axis ticks switch to compact (`$40K`) once the axis reaches 10,000.
- Rule conditions (`when`) are the same as the table's (`equals`, `gt`, `lt`, `in`, …), tested against `value` (or `field: 'label'` / `'series'`).
- Keyboard: focus the chart, then use the arrow keys to move between points, Enter to click and Escape to leave. Animation is off when the user prefers reduced motion.

**Events** are called as `fn(payload, context)`. `onPointClick` / `onPointHover` → `{ chart, index, label, series, seriesName, value, values }` (pie adds `percent`, scatter `x`, `y`, `point`); `onLegendClick` → `{ chart, series, hidden }`.

**Actions** (all take the chart's `id`; `series` is a key / name or index, `point` a label or index):

| Method | Description |
|---|---|
| `getChartData(id)` / `setChartData(id, { labels, series })` | Read / replace data |
| `setChartValue(id, series, point, value)` | Change one value |
| `addChartPoint(id, label, { seriesKey: value }, { max })` / `removeChartPoint(id, point)` | Add / remove a point on every series (`max` keeps the latest N, for live charts) |
| `addChartSeries(id, series)` / `removeChartSeries(id, series)` | Series changes |
| `setChartType(id, type)` | Switch bar / line / area / pie / donut / scatter |
| `highlightChart(id, highlight)` / `clearHighlight(id)` | Highlight marks |
| `toggleSeries(id, key)` | Hide / show a series (a pie slice by label); the legend uses it too |

Any other prop changes with `setNodeProps(id, { stacked: true, rulers: [...] })`.

```js
actions: (api) => ({
  chartTypeChanged: (e, { value }) => api.setChartType('sales', value),           // SelectField onChange (chart)
  marchChanged: (e, { value }) => api.setChartValue('sales', 'online', 'Mar', Number(value)),  // SliderField
  pointClicked: (p) => api.highlightChart('sales', { index: p.index }),
})
```

## Calendar

Live demo: [rcube-html.com/calendar](https://rcube-html.com/calendar)

A calendar with day, week, month, year and schedule (agenda) views: a sidebar with a mini month and calendar toggles, search, drag to create / move / resize, an event editor, repeating events and keyboard shortcuts. Events are meant to come from your API: `onRangeChange` runs on the first render and whenever the visible range changes, and your action answers with `setCalendarEvents`.

```js
{ type: 'Calendar', id: 'team-calendar', props: {
  view: 'week', views: ['day', 'week', 'month', 'year', 'agenda'], date: '2026-11-02',   // date defaults to today
  firstDay: 0, weekends: true, height: 680,
  dayStartHour: 0, dayEndHour: 24, scrollToHour: 8, hourHeight: 48,
  slotMinutes: 30, snapMinutes: 15, defaultDuration: 60,
  workingHours: { start: 9, end: 17, days: [1, 2, 3, 4, 5] },    // shades the rest
  toolbar: true,                                                  // false: no header (today, ‹ ›, title, search, views)
  toolbarActions: [ { text: 'New event', onClick: 'newEvent()' } ],   // your buttons -> { calendar, view, date }
  nowIndicator: true, agendaDays: 30, locale: 'en-US', hour12: true,
  calendars: [ { id: 'work', name: 'Work', color: '#2a78d6' }, { id: 'personal', name: 'Personal' } ],
  events: [                                                       // initial events (or [] and load them)
    { id: 'standup', title: 'Standup', start: '2026-11-02T09:30', end: '2026-11-02T09:45', calendar: 'work',
      location: 'Zoom', recurrence: { freq: 'weekly', byDay: [1, 2, 3, 4, 5] } },
    { id: 'offsite', title: 'Offsite', start: '2026-11-05', end: '2026-11-06', allDay: true },   // end = last day
  ],
  sidebar: true, searchable: true, editable: true, selectable: true, eventEditor: true, autoUpdate: true,
  repeatable: true,             // the event editor's Repeat section (false hides it)
  sidebarToggle: true,          // the hamburger before Today shows / hides the left panel
  // sidebarOpen: true | false    // fixed open / closed; unset: open on large screens, closed on small ones
  keyboardShortcuts: true,
  onRangeChange: 'loadEvents()', onViewChange: 'viewChanged()',
  onEventClick: 'eventClicked()', onSlotClick: 'slotClicked()', onSelect: 'rangeSelected()',
  onEventCreate: 'eventCreated()', onEventUpdate: 'eventUpdated()', onEventDelete: 'eventDeleted()',
  onCalendarToggle: 'calendarToggled()',
} }
```

- **Events**: `id`, `title`, `start` / `end` (`"YYYY-MM-DDTHH:mm"` local, or `"YYYY-MM-DD"` for all-day; an all-day `end` is the last day, inclusive), `allDay`, `calendar`, `color`, `location`, `description`, `editable: false`, `recurrence: { freq: daily | weekly | monthly | yearly, interval, byDay: [0-6], count, until, exceptions: ['YYYY-MM-DD'] }`.
- Timed events of 24 hours or more show in the all-day row; overlapping events sit side by side.
- **Editing**: click or drag on empty time to create, drag an event to move it (to another day too), drag its bottom edge to resize, and click it for details (edit / delete). A repeating event is edited as a series; deleting asks *this event* or *all events*.
- **Repeating events from the editor**: its **Repeat** section makes an event repeat daily, weekly (on the days picked), monthly or yearly, every *N* days / weeks / months / years, ending never, on a date or after a number of times — saved as the event's `recurrence`. Editing a series changes its first occurrence and its schedule; occurrences deleted on their own (`exceptions`) stay deleted. `repeatable: false` hides the section.
- With `autoUpdate: true` (default) the calendar applies the change itself and then calls your action (save it to the API there). With `false` it only calls the action and you update with the actions below.
- **Keyboard**: `T` today, `D` / `W` / `M` / `Y` / `A` views, `J` / `K` next / previous, `C` create, `Esc` closes popovers; events are focusable (Enter opens them).

**Events** are called as `fn(payload, context)`; every payload has `calendar` (the node id):

| Event | Payload |
|---|---|
| `onRangeChange` | `{ view, date, start, end }` (`YYYY-MM-DD`, `end` exclusive) |
| `onViewChange` | `{ view, previousView }` |
| `onEventClick` | `{ event }` (an occurrence of a repeating event has `recurringId`, `occurrence`) |
| `onSlotClick` / `onSelect` | `{ start, end, allDay }` |
| `onEventCreate` | `{ event }` |
| `onEventUpdate` | `{ event, previous, change: 'move' \| 'resize' \| 'edit' }` |
| `onEventDelete` | `{ event, scope: 'all' }` or `{ event, scope: 'one', occurrence, series }` |
| `onCalendarToggle` | `{ calendarId, hidden }` |
| `onSidebarToggle` | `{ open }` (the hamburger showed / hid the left panel) |

**Actions** (all take the calendar's `id`):

| Method | Description |
|---|---|
| `setCalendarEvents(id, events)` / `getCalendarEvents(id)` | Replace (also clears loading) / read events |
| `addCalendarEvent(id, event)` / `updateCalendarEvent(id, eventId, patch)` / `removeCalendarEvent(id, eventId)` | Event changes |
| `setCalendarView(id, view)` / `setCalendarDate(id, date)` | Change view / date |
| `calendarToday(id)` / `calendarNext(id)` / `calendarPrev(id)` | Navigate |
| `getCalendarRange(id)` | `{ view, date, start, end }` currently shown |
| `setCalendarLoading(id, loading)` | Spinner while fetching |
| `toggleCalendar(id, calendarId)` | Hide / show one calendar |

Other props change with `setNodeProps(id, { firstDay: 1, weekends: false, workingHours: {...} })`.

```js
actions: (api) => ({
  loadEvents: async ({ start, end }) => {
    api.setCalendarLoading('team-calendar', true);
    const events = await fetch(`/api/events?start=${start}&end=${end}`).then((r) => r.json());
    api.setCalendarEvents('team-calendar', events);
  },
  eventCreated: ({ event }) => fetch('/api/events', { method: 'POST', body: JSON.stringify(event) }),
  eventUpdated: ({ event }) => fetch(`/api/events/${event.id}`, { method: 'PUT', body: JSON.stringify(event) }),
  eventDeleted: ({ event }) => fetch(`/api/events/${event.id}`, { method: 'DELETE' }),
})
```

## Tree

Live demo: [rcube-html.com/tree](https://rcube-html.com/tree) · [file explorer with lazy loading](https://rcube-html.com/tree-explorer)

A tree with three views — `tree` (classic, optional lines / checkboxes), `explorer` (folder pane + contents with details / list / icons, breadcrumb, sorting, paging) and `columns` (one column per level). Nodes come from the schema, from your API on demand (lazy children, paged with a cursor — fits S3's continuation tokens), or both. Long lists only render the rows on screen.

```js
{ type: 'Tree', id: 'files', props: {
  view: 'explorer', views: ['explorer', 'tree', 'columns'], contentView: 'details', height: 460, rowHeight: 30,
  nodes: [
    { id: 'docs', label: 'Documents', expanded: true, children: [
      { id: 'docs/cv.pdf', label: 'cv.pdf', size: 1200, modified: '2026-10-01T10:00', badge: 'new' } ] },
    { id: 'logs/', label: 'logs', hasChildren: true },          // children load on expand
  ],
  lazyRoot: false,                  // true: the top level loads through onLoadChildren too
  onLoadChildren: 'loadChildren()', pageSize: 50, loadMore: 'scroll',   // scroll | button
  contentPaging: 'scroll',          // explorer contents: scroll | pages
  selectionMode: 'multiple',        // none | single | multiple (Ctrl / Shift, Ctrl+A)
  checkboxes: false, cascadeCheck: true, showLines: true, showIcons: true, showCount: false, indent: 18,
  searchable: true, searchMode: 'client',      // client (highlights, opens matching branches) | server (onSearch)
  filters: [ { id: 'pdf', label: 'PDF', when: { field: 'ext', equals: 'pdf' } } ], filterMode: 'any', remoteFilter: false,
  draggable: true, editable: true, autoUpdate: true,
  contextMenu: [ { text: 'Rename', command: 'rename' }, { text: 'Copy link', onClick: 'copyLink()', when: { field: 'branch', equals: false } } ],
                                    // "text" / "onClick" like every button ("label" / "action" still work)
  toolbarActions: [ { text: 'New folder', onClick: 'newFolder()', needsSelection: true } ],   // -> { tree, selected, checked, nodes }
  columns: [ { key: 'label', title: 'Name' }, { key: 'size', title: 'Size', format: 'bytes', width: '100px', align: 'end' } ],
  rootLabel: 'demo-bucket', title: 'Files', toolbar: true,
  onExpand: '...', onCollapse: '...', onSelect: '...', onActivate: '...', onNodeClick: '...', onNodeDoubleClick: '...',
  onNodeFocus: '...', onCheck: '...', onSearch: '...', onFilterChange: '...', onMove: '...', onRename: '...',
  onDelete: '...', onNavigate: '...', onScrollEnd: '...', onContextMenu: '...',
} }
```

- **Nodes**: `id`, `label` (or `name`), `children`, `hasChildren` (lazy), `hasMore` / `cursor` (more pages), `type: 'folder'`, `expanded`, `icon` (text / emoji), `thumbnail`, `badge`, `description`, `disabled`, `selectable`, `checkable`, `draggable`, `editable`, `className`, plus any data (`size`, `modified`, `ext`, …) for columns and filters.
- **Loading**: `onLoadChildren` gets `{ node, parentId, cursor, offset, pageSize, more, filters }` and returns `{ children, hasMore, cursor }` (or an array). The next page loads when its "load more" row scrolls into view (`loadMore: 'scroll'`) or on click (`'button'`); errors show a Retry. `onLoadMore` (optional) handles pages separately.
- **Server search**: `onSearch` gets `{ query, cursor, pageSize, filters, folder }` and returns `{ nodes, hasMore, cursor }`; results are paged the same way.
- **Filters** use the table's conditions (`equals`, `in`, `gt`, `contains`, …) on node fields (`ext` and `label` are filled in); `filterKeepsBranches` (default true) keeps folders visible; `remoteFilter: true` only fires `onFilterChange` so your API can filter.
- **Context menu** items: `{ label, icon, action: 'name()' }` (your action gets `{ node }`) or `{ command: 'open' | 'rename' | 'expand' | 'collapse' | 'reload' | 'delete' }`; `when` shows an item only for matching nodes (`branch` is true for folders); `{ divider: true }`.
- `onMove` / `onRename` may return `false` (or a promise of false) to refuse; with `autoUpdate: false` the tree only reports and you change it with the actions.
- **Keyboard** (WAI-ARIA tree): ↑ ↓ Home End, → opens / goes to the first child, ← closes / goes to the parent, Enter activates, Space selects (or checks), `*` opens siblings, F2 renames, Delete fires `onDelete`, type-ahead jumps by name, Ctrl+A selects all. Explorer contents: arrows, Enter, Backspace (up a level).

**Events** (`fn(payload, context)`; payloads have `tree`, `node`, `id`, `path` (ancestor ids), `level`): `onExpand` / `onCollapse` / `onActivate` / `onNodeClick` / `onNodeDoubleClick` / `onNodeFocus` / `onContextMenu` → `{ node }`; `onSelect` → `{ selected, nodes }`; `onCheck` → `{ checked, checkedIds, checkedNodes }`; `onMove` → `{ target, position: 'before' | 'after' | 'inside', parentId, index }`; `onRename` → `{ name, previous }`; `onDelete` → `{ ids, nodes }`; `onNavigate` → `{ folder }`; `onFilterChange` → `{ activeFilters, filters }`; `onScrollEnd` → `{ count }`.

**Actions** (all take the tree's `id`):

| Method | Description |
|---|---|
| `getTreeNodes(id)` / `setTreeNodes(id, nodes, { hasMore, cursor })` / `getTreeNode(id, nodeId)` | Read / replace nodes |
| `addTreeNode(id, parentId, node, index?)` / `updateTreeNode(id, nodeId, patch)` / `removeTreeNode(id, nodeId)` / `moveTreeNode(id, nodeId, parentId, index?)` | Change nodes (`parentId` null = top level) |
| `setTreeChildren(id, parentId, children, { hasMore, cursor, append })` / `reloadTreeNode(id, nodeId?)` | Load children yourself / load again |
| `expandTreeNode` / `collapseTreeNode` / `toggleTreeNode(id, nodeId)` / `expandAllTree(id)` / `collapseAllTree(id)` | Expansion (expanding opens the parents too) |
| `selectTreeNode(id, nodeIds)` / `getSelectedTreeNodes(id)` / `checkTreeNodes(id, nodeIds)` / `getCheckedTreeNodes(id)` | Selection / checkboxes |
| `scrollToTreeNode(id, nodeId)` | Open the parents, focus and scroll to a node |
| `setTreeSearch(id, query)` / `setTreeFilters(id, filterIds)` / `setTreeView(id, view)` / `openTreeFolder(id, nodeId)` | Search, filters, view, explorer folder |
| `getTreeState(id)` | `{ view, folder, expanded, selected, checked, search, activeFilters }` |

```js
// S3 through your backend (ListObjectsV2 with Delimiter "/")
actions: (api) => ({
  loadChildren: async ({ parentId, cursor, pageSize }) => {
    const out = await fetch(`/api/s3/list?prefix=${encodeURIComponent(parentId || '')}&token=${cursor || ''}&max=${pageSize}`).then((r) => r.json());
    return {
      children: [
        ...out.CommonPrefixes.map((p) => ({ id: p.Prefix, label: p.Prefix.slice(0, -1).split('/').pop(), hasChildren: true })),
        ...out.Contents.map((o) => ({ id: o.Key, label: o.Key.split('/').pop(), size: o.Size, modified: o.LastModified })),
      ],
      hasMore: out.IsTruncated,
      cursor: out.NextContinuationToken,
    };
  },
})
```

## File upload

Live demo: [rcube-html.com/file-upload](https://rcube-html.com/file-upload)

`FileUploadField` (also `FileUpload`) is a form field: drag & drop, browse, paste or drop anywhere on the page, with validation, thumbnails, image preview, per-file and overall progress, cancel / retry / remove, parallel and manual uploads. It takes part in `required` validation and submitted entries like any other field.

```js
{ type: 'FileUploadField', id: 'docs', props: {
  name: 'documents', label: 'Documents', required: true,
  multiple: true, accept: '.pdf,.docx,image/*',
  maxFiles: 5, minFiles: 1, maxSize: '5MB', minSize: 1, maxTotalSize: '20MB', allowDuplicates: false,
  onUpload: 'uploadDocument()',     // your action uploads each file (or the built-in uploader below)
  autoUpload: true,                 // false: files wait for the "Upload N" button / uploadFiles(name)
  parallel: 3, retries: 1,          // simultaneous uploads; automatic retries before showing ↻
  variant: 'list',                  // list | grid (thumbnail cards)
  compact: false, showThumbnails: true, preview: true,
  dropAnywhere: false, paste: true, directory: false, capture: 'environment', disabled: false,
  title: 'Drag & drop files here', hint: 'PDF or images up to 5 MB', buttonText: 'Browse',
  defaultFiles: [ { id: 'srv-1', name: 'contract.pdf', size: 482133, url: '/files/contract.pdf' } ],
  onValidate: 'checkFile()', onFilesAdded: '...', onFileRejected: '...', onUploadComplete: '...',
  onUploadError: '...', onAllComplete: '...', onRemove: 'deleteOnServer()', onFileClick: '...', onChange: '...',
} }
```

- **File title** (`fileTitle`, shown by default): an optional title box above the drop zone (`fileTitleMax`, 50 characters; `fileTitleLabel`, `fileTitlePlaceholder`). The files added next get the title typed there, then the box clears. `onUpload` gets it as `title`, the built-in uploader sends it as the form field `title`, each file in the value has `title`, and `defaultFiles` can carry one. The list shows the title above the file name. `fileTitle: false` hides it.
- **Built-in uploader** (instead of `onUpload`): `uploadUrl`, `uploadMethod` (`POST`), `uploadFieldName` (`file`), `uploadHeaders`, `uploadData` (extra form fields), `withCredentials`. The JSON response becomes the file's `response`; a `url` (or `location`) in it becomes the file's link.
- **No uploader**: files are kept and submitted with the form as `File` objects (`file` on each entry).
- Sizes accept bytes or `'500KB'`, `'5MB'`, `'1GB'`. Rejected files stay in the list with the reason until dismissed.
- **Value** (submitted entries, `getFiles`, the `onChange` context): `[{ id, name, size, type, status, progress, title?, url?, response?, file? }]` — rejected and failed files are left out.
- **Validation on Submit**: blocks while files are uploading, not yet uploaded (`autoUpload: false`) or failed; then `required` / `minFiles`. Messages: `requiredMessage`, `minFilesMessage`, `uploadingMessage`, `pendingMessage`, `failedMessage`.

**Uploading in an action**: `onUpload` gets `{ file, name, size, type, title, id, attempt, onProgress(percent), signal }` and returns (or resolves to) the server's answer; throw / reject to mark the file as failed. `signal` aborts when the user cancels. `uploadWithXhr` (exported) reports progress:

```js
import { uploadWithXhr } from 'rcube-html';

actions: (api) => ({
  uploadDocument: ({ file, onProgress, signal }) =>
    uploadWithXhr({ url: '/api/files', file, onProgress, signal, headers: { Authorization: `Bearer ${token}` } }),
  checkFile: ({ name }) => (/draft/i.test(name) ? 'Drafts are not accepted.' : ''),   // '' = OK
  deleteOnServer: async ({ file }) => {                                                  // false / throw keeps the file
    await fetch(`/api/files/${file.response.id}`, { method: 'DELETE' });
  },
})
```

**Events** (payloads have `field`): `onFilesAdded` → `{ files, source: 'browse' | 'drop' | 'paste' | 'page' | 'code' }`, `onFileRejected` → `{ file, reason: 'type' | 'size' | 'minSize' | 'count' | 'total' | 'duplicate' | 'custom', message }`, `onUploadComplete` → `{ file, response }`, `onUploadError` → `{ file, error }`, `onAllComplete` → `{ files, failed }`, `onRemove` / `onFileClick` → `{ file }`, `onValidate` → `{ file, name, size, type }`.

**Actions** (take the field's `name`): `getFiles(name)`, `uploadFiles(name)`, `clearFiles(name)`, `removeFile(name, fileId)`, `retryFile(name, fileId)`, `openFilePicker(name)`, `addFiles(name, files)`. `setFieldValue(name, [{ name, size, url }])` shows files that are already on the server; `clearForm` empties the field.

## Rich text

`RichTextField` is a form field: a formatting toolbar, an optional **Source** view to edit the HTML itself, paste cleaning, a character counter. Its value is cleaned HTML (paragraphs, line breaks, bold / italic / underline / strike, headings, lists, quotes, safe links), kept in a hidden `<textarea>`, so `required`, `setFieldValue`, `data`, `getFormEntries` and `runValidation` work as for any field. `required` and `maxLength` count the text, not the markup. Older plain-text values show as text with their line breaks.

```js
{ type: 'RichTextField', id: 'details', props: {
  name: 'details', label: 'Details', required: true, hint: 'Shown under the editor', placeholder: 'Write here…',
  maxLength: 4000, maxLengthMessage: '...', counter: true, minHeight: 140, maxHeight: 480, disabled: false, readOnly: false,
  toolbar: ['bold', 'italic', 'underline', 'strike', '|', 'heading', 'bulletList', 'numberList', 'quote', '|', 'link', 'clear'],
  //   built in: bold italic underline strike heading bulletList numberList quote link unlink clear undo redo
  //   "|" = a gap; an array = a group; false = no toolbar; your own tools:
  //     { key: 'sign', text: 'Signature', title: 'Add my signature', html: '<p>— Ann</p>' }   inserts the HTML
  //     { key: 'improve', text: 'Improve', icon: '✨', onClick: 'improveText()' }           runs your action
  source: true,                     // the Source button (false hides it); the HTML is cleaned going back
  headingTag: 'h4',                 // what "heading" makes: h3 | h4 | h5
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'a', 'div'],
  onLink: 'pickLink()',             // your action gives the web address (or a Promise of it); default: a prompt
  onChange: '...', onFocus: '...', onBlur: '...',
} }
```

Your tool's action (and `onLink`) gets `(event, { name, value, editor })`, where `editor` has `getHtml()`, `setHtml(html)`, `insertHtml(html)`, `insertText(text)` and `focus()`:

```js
actions: {
  improveText: async (event, { editor }) => editor.setHtml(await improve(editor.getHtml())),
  pickLink: async () => (await openLinkPicker())?.url,
}
```

Show it with `{ type: 'RichText', id: 'd1', props: { html: saved.details, emptyText: 'Nothing yet' } }` (cleaned again). The cleaner is exported for your own use — `cleanHtml(html, { allowedTags })`, `htmlToText(html)`, `isHtml(value)`, `escapeHtml(text)` — clean again on the server before saving.

## Field props

Live demo: [rcube-html.com/validation](https://rcube-html.com/validation)

| Prop | Applies to | Effect |
|---|---|---|
| `name` | all fields | Field key in values / errors / submitted entries (defaults to the node `id`) |
| `label`, `placeholder` | all fields | Text; a red `*` is added to the label when `required` |
| `hint` | all fields | Help text under the field (the error message takes its place while there is one) |
| `required`, `requiredMessage` | all fields | Must have a value (checkbox: checked; checkbox group: at least one) |
| `pattern`, `patternMessage` | text inputs | Regular expression the whole value must match |
| `min`, `max`, `rangeMessage` | `type: "number"` | Numeric range |
| `allowedValues`, `allowedValuesMessage` | inputs | Only these values are accepted, e.g. `[10, 11, 15, 20]` |
| `numberMessage` | `type: "number"` | Shown when the text isn't a number |
| `beforeToday`, `beforeTodayMessage` | `type: "date"` | Date must be before today (also limits the picker) |
| `maxYearsAgo`, `maxYearsAgoMessage` | `type: "date"` | Date no more than N years ago |
| `requiredOptions`, `requiredOptionsMessage` | `CheckboxGroupField` | These option values must all be checked |
| `uppercase` / `lowercase` | text inputs | Convert as the user types |
| `mask` | text inputs | Format while typing; `#` = digit, e.g. `"(###) ###-####"` |
| `optionsFrom` | `SelectField` | Options follow another field — see below |

Per-field messages override the library defaults.

## Conditional fields — `visibleWhen`

Live demo: [rcube-html.com/conditional-fields](https://rcube-html.com/conditional-fields)

Any node (row, column or field) can be shown only when another field has a value. Hidden fields are not rendered, so they are skipped by validation.

```js
{ type: 'column', id: 'col-email', visibleWhen: { field: 'contactPreferences', includesAny: ['email'] }, children: [...] }
```

Tests: `equals` (radio / select / text), `includesAny`, `includesAll` (checkbox groups).

## Dependent selects — `optionsFrom`

Live demo: [rcube-html.com/select-fields](https://rcube-html.com/select-fields)

```js
{ type: 'SelectField', id: 'county', props: { name: 'county', label: 'County',
  optionsFrom: { field: 'state', map: { California: ['Alameda', 'Alpine', ...], ... },
                 waitingText: 'Select a state first', emptyText: 'No counties listed for {value}' } } }
```

The list follows the `state` field; changing the state clears the county. A select with no options is not required.

## Events and actions

Live demo: [rcube-html.com/events-actions](https://rcube-html.com/events-actions)

Any `on…` prop in the schema names an action:

```js
{ type: 'InputField', id: 'zip', props: { name: 'zip', onChange: 'zipChanged()', onBlur: 'zipBlurred()' } }
```

Define actions in `useDynamicTag`. Each is called as `(event, context)` where `context` is `{ name, value, values, fieldRefs }`:

```js
const form = useDynamicTag({
  schema,
  actions: (api) => ({
    zipChanged: (e, { name, value }) => console.log(name, value),
    fillDemo: () => api.setFormData({ firstName: 'JANE', state: 'California', county: 'Alameda' }),
  }),
});
```

**Built-in actions** (usable from the schema by name): `runValidation`, `clearForm`, `resetForm`, `addCopy`, `removeCopy`, `switchLanguage` (reads the button's `data-lang`, e.g. `"data-lang": "es"`), `openModal` / `closeModal` (read `data-modal`), `selectTab` (reads `data-tabs` and `data-key`; works for Accordion too).

### The same shape everywhere

- **Options** are schema `props`; whatever changes at runtime (rows, events, nodes, view, selection) lives in the form's element state and changes through `form.actions` (`setRows`, `setCalendarEvents`, `setTreeNodes`, `setNodeProps`, …).
- **Events** are `"onXxx": "actionName()"` props, run as `fn(payload, context)`.
- **Your buttons** use one shape on every component — `{ key, text, icon, title, variant, className, onClick: 'action()', needsSelection, disabled }`: `toolbarActions` on DataTable, Calendar and Tree, a table column's `actions`, a Tree's `contextMenu` (plus `command`), RichTextField's own `toolbar` tools (plus `html`).
- **Fields** all take `name`, `label`, `hint`, `required` / `requiredMessage`, `disabled`, `className`, `onChange` / `onFocus` / `onBlur`.

### `form.actions` methods

| Method | Description |
|---|---|
| `runValidation()` | Validate visible fields; on success calls `onSubmit(entries)` and returns the entries |
| `getFormEntries()` | `[{ field: value, ... }]` — one object per entry, same keys in each |
| `getFormData()` | Flat `{ field: value }` for every rendered field |
| `setFieldValue(name, value)` / `setFormData({ ... })` | Set values (works for hidden and dependent fields too) |
| `clearForm()` / `resetForm()` | Empty everything / restore `data` |
| `setNodeProps(id, props)` | Change any node's props at runtime, e.g. `{ text }`, `{ style: { color } }`, `{ className }` |
| `hideNode` / `showNode` / `toggleNode(id)` | Hide or show a node (it stays mounted; hidden fields are not validated) |
| `removeNode` / `restoreNode(id)` | Remove a node from the page / bring it back |
| `resetNode(id)` / `resetNodes()` | Undo runtime changes |
| `addCopy()` / `removeCopy(copyId)` | Repeatable entries (with `repeatable: true`) |
| `openModal(id)` / `closeModal(id)` | Open / close a Modal |
| `selectTab(id, key)` | Switch a Tabs (or Accordion) node to a tab / panel |

## Repeatable entries

Live demo: [rcube-html.com/repeatable-entries](https://rcube-html.com/repeatable-entries)

```js
const form = useDynamicTag({ schema, buttons, repeatable: true });
// schema button: { type: 'ButtonField', id: 'add', props: { text: '@repeat.addAnother', onClick: 'addCopy()' } }
```

Each added entry gets an "Entry N" heading and a Remove button. Field names in copies get a `__N` suffix internally; `getFormEntries()` and `onSubmit` strip it:

```js
[{ firstName: 'JOHN', email: '...' }, { firstName: 'JANE', email: '...' }]
```

## Languages

Live demo: [rcube-html.com/languages](https://rcube-html.com/languages)

Write `@key` instead of fixed text anywhere in a node's props, and provide message sets:

```js
// text_en.js
import libEn from 'rcube-html/lang/lang_en';
export default { ...libEn, form: { firstName: { label: 'First Name' } } };

// text_es.js
import libEs from 'rcube-html/lang/lang_es';
export default { ...libEs, form: { firstName: { label: 'Nombre' } } };
```

```js
{ type: 'InputField', id: 'first', props: { name: 'firstName', label: '@form.firstName.label' } }

const form = useDynamicTag({
  schema,
  messages: textEn,                               // starting text and fallback
  language: 'en',
  languages: { en: textEn, es: () => import('./text_es') },   // loaded on demand
});
// switch: form.setLanguage('es'), or a button { "data-lang": "es", "onClick": "switchLanguage()" }
```

Missing keys fall back to `messages`, then to the library English. The library ships `lang_en` and `lang_es`; copy `rcube-html/lang/lang_en` to add another language. Each `<DynamicTag>` uses its own form's language.

## Custom components

Live demo: [rcube-html.com/custom-components](https://rcube-html.com/custom-components)

```js
import { registerComponent } from 'rcube-html';

registerComponent('Rating', RatingDisplay);                     // display component
registerComponent('RatingField', RatingField, { field: true }); // form field
registerComponent('Panel', Panel, { container: true });         // holds other nodes
registerComponent('NoteField', NoteField, { field: true, actions: true }); // a field that also gets the form's `actions`
```

Field components must `forwardRef` to their input element (or a `<fieldset>` for groups) and accept `name`, `error` and `onChange`.

Container components receive `node`, `nodeId`, `items` (translated), `renderNodes` and `actions`, and render nested nodes with `renderNodes(...)`:

```jsx
const Panel = ({ node, renderNodes, title }) => (
  <section className="rc-border rc-rounded rc-p-3 rc-mb-3">
    <h6>{title}</h6>
    {renderNodes(node.children)}
  </section>
);
// { type: 'Panel', id: 'p1', props: { title: 'Details' }, children: [ /* nodes, including fields */ ] }
```

Panes that should open on a failed Submit are marked `data-rcube-pane="<key>"` inside an element marked `data-rcube-container`; listen for the `REVEAL_EVENT` (exported) on that element to open the pane.

## Rendering another schema with the same form

```jsx
<DynamicTag form={form} schema={toolbarSchema} />  // shares actions, element state and language
<DynamicTag form={form} />                         // the form itself
```

## Author

Riyaz Hameed — [riyaz.mohamed@gmail.com](mailto:riyaz.mohamed@gmail.com)

## License

MIT License, Apache License 2.0, and BSD License
This software is provided “as is,” without warranty of any kind, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. In no event shall the authors be liable for any claim, damages, or other liability arising from the use of this software.