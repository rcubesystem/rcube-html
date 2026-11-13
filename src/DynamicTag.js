import { useMemo } from "react";
import { LayoutParser } from "./html";
import { I18nContext } from "./i18n";
import { normalizeSchema, schemaIds } from "./schema";

/**
 * Render a form created with useDynamicTag():
 *   <DynamicTag form={form} />                    // all copies + buttons
 *   <DynamicTag form={form} schema={otherNodes} /> // another schema sharing the form's actions,
 *                                                   // element state and language (e.g. a toolbar)
 * className (optional) wraps the output in a <div>.
 * Another schema is made regular like the form's (single children as objects, optional ids: its generated ids start
 * with "extra-" and never take one of the form's).
 */
export const DynamicTag = ({ form, schema, className }) => {
  const extra = useMemo(() => (schema ? normalizeSchema(schema, { taken: schemaIds(form.fullSchema), prefix: 'extra-' }) : null), [schema, form.fullSchema]);
  const nodes = extra ?? form.fullSchema;
  const content = nodes.map((node) => <LayoutParser key={node.id} node={node} {...form.parserProps} />);
  return (
    <I18nContext.Provider value={form.t}>
      {className ? <div className={className}>{content}</div> : content}
    </I18nContext.Provider>
  );
};
