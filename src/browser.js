// dist/browser/rcube-html.js: one <script> for pages without a bundler (JSP, PHP, ASP.NET, CMS pages, plain HTML).
// Defines <rcube-form> and window.RcubeHtml (mount, registerComponent, normalizeSchema, …, and React for
// components registered from the page).
export * from "./element/index";

// the library's Spanish texts (rcube-html/lang/lang_es), for pages without a bundler: RcubeHtml.langEs
export { default as langEs } from "./lang/lang_es";
