// <rcube-form>: rcube-html as a web component, for pages that aren't React — Angular, Vue, plain JavaScript, server
// pages (JSP, PHP, ASP.NET, Django, …) and CMS pages. The element brings its own copy of React (rcube-html/element
// bundles it), so the page needs nothing else. React apps keep using useDynamicTag / DynamicTag.
//
//   <rcube-form id="signup" actions="signupActions">
//     <script type="application/json" data-rcube="schema">[ … the schema … ]</script>
//   </rcube-form>
//
// Options — as properties (objects, from JavaScript / Angular / Vue), or as JSON inside the element:
//   schema, buttons, actions, messages, languages, language, data, repeatable, values
//   <script type="application/json" data-rcube="schema|buttons|messages|languages|data|values">…</script>
//   <script type="application/json" data-rcube="config">{ "schema": […], "buttons": […], "values": {…} }</script>
// Attributes
//   schema-src="/schemas/signup.json"  fetch the schema (a list) or a config object ({ schema, buttons, … })
//   actions="signupActions"            a global object holding actions: signupActions.save(event, context, api)
//   language="es", repeatable
// Events (CustomEvent, bubbling; the data is in event.detail)
//   rcube-ready   { api }                          the form is on the page
//   rcube-change  { values, entries }              a field changed (entries: one object per form copy)
//   rcube-submit  { entries, values }              runValidation() passed (values: the first copy)
//   rcube-action  { name, event, context, api }    the schema ran an action nobody defined: handle it in your code
// el.api: every form action (setFormData, getFormEntries, setNodeProps, hideNode, runValidation, …)
// el.ready: a Promise of the api, for a script that may run after the form started (el.ready.then((api) => …))
//
// Markup already inside the element (a server-rendered form, a "loading" message) stays until the form replaces it.
import { createElement as h, useEffect, useMemo, useRef } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { DynamicTag } from "./DynamicTag";
import { useDynamicTag } from "./useDynamicTag";

export const FORM_OPTIONS = ["schema", "buttons", "actions", "messages", "languages", "language", "data", "repeatable", "values"];
// options that can be written as JSON in the page
const JSON_OPTIONS = FORM_OPTIONS.filter((key) => key !== "actions");

// Every "name()" in a schema: the actions it can run
const ACTION_CALL = /^\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*$/;
export const actionNamesIn = (value, names = new Set()) => {
  if (typeof value === "string") {
    const m = ACTION_CALL.exec(value);
    if (m) names.add(m[1]);
  } else if (Array.isArray(value)) value.forEach((v) => actionNamesIn(v, names));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => actionNamesIn(v, names));
  return names;
};

// a config object ({ schema, buttons, … }) or a schema (a list) -> options
const optionsFromJson = (value) => (Array.isArray(value) ? { schema: value } : Object.fromEntries(Object.entries(value || {}).filter(([key]) => JSON_OPTIONS.includes(key))));

// "signupActions" or "app.forms.signup" -> that global object
const globalObject = (path) => (path ? path.split(".").reduce((obj, key) => obj?.[key], typeof window === "undefined" ? globalThis : window) : null);

function ElementForm({ host, options }) {
  const { schema = [], buttons = [], actions, messages, languages, language, data, repeatable, values } = options;
  const names = useMemo(() => actionNamesIn([schema, buttons]), [schema, buttons]);
  // `language` isn't given to useDynamicTag (there it only names the starting text): the effect below switches to it
  const form = useDynamicTag({
    schema, buttons, messages, languages, data, repeatable,
    actions: (api) => {
      const own = (typeof actions === "function" ? actions(api) : actions) || {};
      // an action the schema names that isn't built in or given: the global object (attribute "actions"), else an event
      const outside = {};
      names.forEach((name) => {
        if (!(name in api) && !(name in own)) outside[name] = (event, context) => host.runOutsideAction(name, event, context, api);
      });
      return { ...outside, ...own };
    },
    onSubmit: (entries) => host.emit("rcube-submit", { entries, values: entries?.[0] }),
  });
  host.form = form;

  // values given to the element: written into the fields, again each time a new object is given — except values the
  // form itself just sent (a page that sets el.values from rcube-change would otherwise go round in circles)
  useEffect(() => {
    if (values && values !== host.sent?.values && values !== host.sent?.entries?.[0] && values !== host.sent?.entries) form.actions.setFormData(values);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      return;
    }
    host.sent = { values: form.values, entries: form.actions.getFormEntries() };
    host.emit("rcube-change", host.sent);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values]);
  // language: switched to when it's in languages (also when language or languages come after the form started)
  useEffect(() => {
    if (language && language !== form.language && languages?.[language]) form.setLanguage(language);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language, languages]);
  useEffect(() => {
    host.resolveReady(host.liveApi);
    host.emit("rcube-ready", { api: host.liveApi });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return h(DynamicTag, { form });
}

// On the server (no DOM) the class still has to be definable: the element is only defined in a browser
const Base = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

export class RcubeFormElement extends Base {
  constructor() {
    super();
    this.options = {};
    this.root = null;
    this.form = null;
    // The api handed out by el.ready and rcube-ready: always the form's current actions (they are made again on each
    // draw, and actions given later — el.actions = { … } — are only in the newer ones)
    const current = () => this.form?.actions || {};
    this.liveApi = new Proxy({}, {
      get: (_, key) => current()[key],
      has: (_, key) => key in current(),
      ownKeys: () => Reflect.ownKeys(current()),
      getOwnPropertyDescriptor: (_, key) => (key in current() ? { value: current()[key], enumerable: true, configurable: true } : undefined),
    });
    // el.ready.then((api) => …): also for a script that runs after the form started (rcube-ready already sent)
    this.ready = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
  }

  connectedCallback() {
    // Angular / Vue / scripts may set properties before the element is defined: take them over
    for (const key of FORM_OPTIONS) {
      if (Object.prototype.hasOwnProperty.call(this, key)) {
        const value = this[key];
        delete this[key];
        this[key] = value;
      }
    }
    if (this.root || this.loading) return; // moved in the page: keep the form
    this.readPage();
    const src = this.getAttribute("schema-src");
    if (src && !this.options.schema) {
      this.loading = fetch(src)
        .then((res) => {
          if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
          return res.json();
        })
        .then((json) => {
          const given = Object.fromEntries(Object.entries(this.options).filter(([, value]) => value !== undefined));
          this.options = { ...optionsFromJson(json), ...given };
          this.loading = null;
          if (this.isConnected) this.start();
        })
        .catch((error) => {
          this.loading = null;
          console.error(`<rcube-form schema-src="${src}">: the schema couldn't be loaded.`, error);
          this.emit("rcube-error", { error });
        });
      return;
    }
    this.start();
  }

  disconnectedCallback() {
    // removed for good (not just moved): stop React
    queueMicrotask(() => {
      if (this.isConnected || !this.root) return;
      this.root.unmount();
      this.root = null;
      this.form = null;
    });
  }

  // JSON in the page and plain attributes; properties already set win
  readPage() {
    const found = {};
    for (const script of [...this.children]) {
      if (script.tagName !== "SCRIPT" || script.type !== "application/json") continue;
      const what = script.getAttribute("data-rcube") || "config";
      try {
        const json = JSON.parse(script.textContent || "null");
        Object.assign(found, what === "config" ? optionsFromJson(json) : JSON_OPTIONS.includes(what) ? { [what]: json } : {});
      } catch (error) {
        console.error(`<rcube-form>: the JSON in <script data-rcube="${what}"> isn't valid.`, error);
      }
    }
    if (this.hasAttribute("language")) found.language = this.getAttribute("language");
    if (this.hasAttribute("repeatable")) found.repeatable = this.getAttribute("repeatable") !== "false";
    const given = Object.fromEntries(Object.entries(this.options).filter(([, value]) => value !== undefined));
    this.options = { ...found, ...given };
  }

  start() {
    // the form goes into its own box; what was in the element (server-rendered markup) leaves once it's drawn
    const box = document.createElement("div");
    box.setAttribute("data-rcube-root", "");
    box.style.display = "contents";
    this.appendChild(box);
    this.root = createRoot(box);
    flushSync(() => this.draw());
    [...this.childNodes].forEach((node) => node !== box && node.remove());
  }

  draw() {
    this.root?.render(h(ElementForm, { host: this, options: this.options }));
  }

  // A new option: drawn once the script setting it is done (several set together draw once), and before promise
  // callbacks that run after it — el.ready.then(…) sees the actions given just before
  render() {
    if (!this.root || this.drawQueued) return;
    this.drawQueued = true;
    queueMicrotask(() => {
      this.drawQueued = false;
      if (this.root) flushSync(() => this.draw());
    });
  }

  emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  runOutsideAction(name, event, context, api) {
    const holder = globalObject(this.getAttribute("actions"));
    if (typeof holder?.[name] === "function") return holder[name](event, context, api);
    this.emit("rcube-action", { name, event, context, api });
    return undefined;
  }

  // every form action: el.api.setFormData({ … }), el.api.getFormEntries(), el.api.runValidation(), …
  get api() {
    return this.form ? this.liveApi : undefined;
  }
}

// schema, buttons, actions, … as properties: a new value draws the form again
for (const key of FORM_OPTIONS) {
  Object.defineProperty(RcubeFormElement.prototype, key, {
    get() { return this.options[key]; },
    set(value) {
      this.options = { ...this.options, [key]: value };
      this.render();
    },
    configurable: true,
  });
}

/** Define the element (once): defineRcubeForm() -> <rcube-form>, or another tag name. */
export const defineRcubeForm = (tag = "rcube-form") => {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(tag)) customElements.define(tag, class extends RcubeFormElement {});
};

/**
 * Put a form into any element, from plain JavaScript (jQuery, Svelte, Lit, a CMS portlet, …):
 *   const el = mount("#signup", { schema, actions: { save }, onSubmit: ({ entries }) => send(entries) });
 *   el.api.setFormData({ email: "a@b.c" });   el.remove();   // takes the form away
 * on…: onSubmit, onChange, onAction, onReady (each gets the event's detail).
 */
export const mount = (target, { onSubmit, onChange, onAction, onReady, onError, ...options } = {}) => {
  defineRcubeForm();
  const parent = typeof target === "string" ? document.querySelector(target) : target;
  if (!parent) throw new Error(`rcube-html mount(): no element matches ${target}`);
  const el = document.createElement("rcube-form");
  const listen = (name, fn) => fn && el.addEventListener(name, (e) => fn(e.detail, e));
  listen("rcube-submit", onSubmit);
  listen("rcube-change", onChange);
  listen("rcube-action", onAction);
  listen("rcube-ready", onReady);
  listen("rcube-error", onError);
  Object.assign(el, options);
  parent.replaceChildren(el);
  return el;
};
