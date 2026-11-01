# rcube-html

Schema-driven forms and layouts for **React + React-Bootstrap**. Describe rows, columns, fields and buttons as JSON-like objects; rcube-html renders them with validation, conditional fields, dependent selects, input masks, repeatable entries, runtime element changes and multi-language text.

```bash
npm install rcube-html react-bootstrap bootstrap
```

Peer dependencies: `react` ≥ 18, `react-dom` ≥ 18, `react-bootstrap` ≥ 2.10, `bootstrap` ≥ 5.3. Import Bootstrap's CSS once in your app:

```js
import 'bootstrap/dist/css/bootstrap.min.css';
```

Works in Next.js App Router (the bundle is marked `"use client"`).

## Quick start

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
    { type: 'column', id: 'cb', props: { className: 'd-flex justify-content-end gap-2' }, children: [
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

## Schema nodes

Every node has a unique `id`. Layout nodes have `children`; component nodes have `props`.

| `type` | Renders | Notes |
|---|---|---|
| `row` | Bootstrap `Row` (top-level rows are wrapped in a `Container`) | `props.className` |
| `column` | Bootstrap `Col` | `props.className` |
| `InputField` | `<input>` — text, email, password, number, date, tel, checkbox, radio, color, range, … | `props.type` |
| `TextareaField` | `<textarea>` | `rows` (default 4) |
| `SelectField` | `<select>` | `options`, `optionsFrom`, `placeholder` |
| `RadioGroupField` | One choice from `options` | `inline` (default true) |
| `CheckboxGroupField` | Any number of `options`; value is an array | `requiredOptions` |
| `ButtonField` | React-Bootstrap `Button` | `text`, `variant`, `size`, `onClick` |
| `Text` | Any of h1–h6, p, span, small, strong, em, label, blockquote | `tag`, `text` |
| `H1`…`H6`, `P`, `SPAN`, `SMALL`, `STRONG`, `EM`, `LABEL`, `BLOCKQUOTE` | Shortcuts for `Text` | `text` |
| `A`, `IMG`, `DIV`, `LIST`, `Card` | Link, responsive image, div, list (`items`), card (`title`, `content`) | |

`{ type: 'component', componentName: 'InputField' }` is also accepted.

`options` can be strings (`["Yes", "No"]`) or `{ label, value }` objects.

## Field props

| Prop | Applies to | Effect |
|---|---|---|
| `name` | all fields | Field key in values / errors / submitted entries (defaults to the node `id`) |
| `label`, `placeholder` | all fields | Text; a red `*` is added to the label when `required` |
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

Any node (row, column or field) can be shown only when another field has a value. Hidden fields are not rendered, so they are skipped by validation.

```js
{ type: 'column', id: 'col-email', visibleWhen: { field: 'contactPreferences', includesAny: ['email'] }, children: [...] }
```

Tests: `equals` (radio / select / text), `includesAny`, `includesAll` (checkbox groups).

## Dependent selects — `optionsFrom`

```js
{ type: 'SelectField', id: 'county', props: { name: 'county', label: 'County',
  optionsFrom: { field: 'state', map: { California: ['Alameda', 'Alpine', ...], ... },
                 waitingText: 'Select a state first', emptyText: 'No counties listed for {value}' } } }
```

The list follows the `state` field; changing the state clears the county. A select with no options is not required.

## Events and actions

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

**Built-in actions** (usable from the schema by name): `runValidation`, `clearForm`, `resetForm`, `addCopy`, `removeCopy`, `switchLanguage` (reads the button's `data-lang`, e.g. `"data-lang": "es"`).

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

## Repeatable entries

```js
const form = useDynamicTag({ schema, buttons, repeatable: true });
// schema button: { type: 'ButtonField', id: 'add', props: { text: '@repeat.addAnother', onClick: 'addCopy()' } }
```

Each added entry gets an "Entry N" heading and a Remove button. Field names in copies get a `__N` suffix internally; `getFormEntries()` and `onSubmit` strip it:

```js
[{ firstName: 'JOHN', email: '...' }, { firstName: 'JANE', email: '...' }]
```

## Languages

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

```js
import { registerComponent } from 'rcube-html';

registerComponent('Rating', RatingDisplay);                     // display component
registerComponent('RatingField', RatingField, { field: true }); // form field
```

Field components must `forwardRef` to their input element (or a `<fieldset>` for groups) and accept `name`, `error` and `onChange`.

## Rendering another schema with the same form

```jsx
<DynamicTag form={form} schema={toolbarSchema} />  // shares actions, element state and language
<DynamicTag form={form} />                         // the form itself
```

## License

MIT
