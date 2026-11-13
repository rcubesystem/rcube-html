import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  // index = the whole library; core = without the table, chart, calendar, tree, rich text and upload, which have entry
  // points of their own (each adds its components to schemas when imported); lang/* = language files on their own
  entry: {
    index: "src/index.js",
    core: "src/core.js",
    table: "src/table.js",
    chart: "src/chart.js",
    calendar: "src/calendar.js",
    tree: "src/tree.js",
    richtext: "src/richtext.js",
    upload: "src/upload.js",
    // Node servers: renderFormHtml() writes a <rcube-form> (with the form drawn) into a page
    server: "src/server.js",
    "lang/lang_en": "src/lang/lang_en.js",
    "lang/lang_es": "src/lang/lang_es.js",
  },
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  // Source files are .js with JSX
  // styles.css: bundled as text (added to the page when it isn't loaded) and copied to dist/styles.css
  loader: { ".js": "jsx", ".css": "text" },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  // Components use hooks / refs; Next.js App Router needs this directive at the top of the bundle
  banner: { js: '"use client";' },
  // react, react-dom come from the consuming project (peerDependencies)
  external: ["react", "react-dom"],
  async onSuccess() {
    copyFileSync("src/styles.css", "dist/styles.css");
  },
  // Shared code goes in chunks every entry point imports, so 'rcube-html/core' and 'rcube-html/chart' use the SAME
  // component registry, translations context and view store (one copy, never two)
  splitting: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
});
