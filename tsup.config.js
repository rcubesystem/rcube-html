import { defineConfig } from "tsup";

export default defineConfig({
  // index = the whole library; lang/* = language files importable on their own ('rcube-html/lang/lang_es')
  entry: {
    index: "src/index.js",
    "lang/lang_en": "src/lang/lang_en.js",
    "lang/lang_es": "src/lang/lang_es.js",
  },
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "cjs" ? ".cjs" : ".js" }),
  // Source files are .js with JSX
  loader: { ".js": "jsx" },
  esbuildOptions(options) {
    options.jsx = "automatic";
  },
  // Components use hooks / refs; Next.js App Router needs this directive at the top of the bundle
  banner: { js: '"use client";' },
  // react, react-dom, react-bootstrap, bootstrap come from the consuming project (peerDependencies)
  external: ["react", "react-dom", "react-bootstrap", "bootstrap"],
  splitting: false,
  sourcemap: true,
  clean: true,
  target: "es2020",
});
