// Types for rcube-html/server
import type { FormOptions } from "./element";

/** JSON that is safe inside a <script> element */
export declare function jsonForScript(value: unknown): string;
/** The options as the JSON <rcube-form> reads: <script type="application/json" data-rcube="config">…</script> */
export declare function formConfigScript(options: Omit<FormOptions, "actions">): string;
/** The <rcube-form> element as HTML: its JSON and (prerender, the default) the form drawn on the server */
export declare function renderFormHtml(
  options: Omit<FormOptions, "actions">,
  settings?: { tag?: string; attributes?: Record<string, string | number | boolean | null | undefined>; prerender?: boolean },
): string;
