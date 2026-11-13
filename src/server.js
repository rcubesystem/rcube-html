// rcube-html/server: write a <rcube-form> into a page made on the server.
//
// Node servers (Express, Fastify, Nest, Nuxt / Angular server routes, …) can also draw the form, so it shows before
// any JavaScript runs:
//   import { renderFormHtml } from "rcube-html/server";
//   res.send(`<html>…${renderFormHtml({ schema, values }, { attributes: { id: "signup", actions: "signupActions" } })}…
//     <script src="/rcube-html/rcube-html.js"></script>`);
// The page's <rcube-form> element then takes over (the drawn markup is replaced by the live form).
//
// Servers in other languages (Java / JSP, PHP, .NET, Python) write the same thing themselves: the element with its
// options as JSON — formConfigScript() shows the format, and integrations/jsp/rcube-form.tag does it for JSP.
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { DynamicTag } from "./DynamicTag";
import { useDynamicTag } from "./useDynamicTag";
import "./index";

const escapeAttr = (value) => String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const JSON_OPTIONS = ["schema", "buttons", "messages", "languages", "language", "data", "repeatable", "values"];

/** JSON that is safe inside a <script> element ("</script>" and line separators can't end it early). */
export const jsonForScript = (value) => JSON.stringify(value ?? null)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

const pick = (options = {}) => Object.fromEntries(JSON_OPTIONS.filter((key) => options[key] !== undefined).map((key) => [key, options[key]]));

/** The options as the JSON <rcube-form> reads: <script type="application/json" data-rcube="config">{…}</script> */
export const formConfigScript = (options) => `<script type="application/json" data-rcube="config">${jsonForScript(pick(options))}</script>`;

function ServerForm({ options }) {
  const { values, ...rest } = options;
  const form = useDynamicTag(rest);
  return h(DynamicTag, { form });
}

/**
 * The <rcube-form> element as HTML: its options as JSON, and (prerender, the default) the form drawn on the server.
 *   options     schema, buttons, messages, languages, language, data, repeatable, values (JSON only: actions are
 *               given in the browser — the "actions" attribute, el.actions or the rcube-action event)
 *   attributes  the element's attributes: { id, class, actions, language, … }
 *   prerender   false: only the element and its JSON (the form is drawn in the browser)
 * Values are filled in when the form starts in the browser; the drawn form shows the schema's own defaults.
 */
export const renderFormHtml = (options = {}, { tag = "rcube-form", attributes = {}, prerender = true } = {}) => {
  const config = pick(options);
  const attrs = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== false)
    .map(([name, value]) => (value === true ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`))
    .join("");
  const drawn = prerender ? `<div data-rcube-ssr>${renderToString(h(ServerForm, { options: config }))}</div>` : "";
  return `<${tag}${attrs}>${formConfigScript(config)}${drawn}</${tag}>`;
};
