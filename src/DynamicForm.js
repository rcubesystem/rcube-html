import { LayoutParser } from "./html";
import { I18nContext } from "./i18n";

/**
 * Render a form created with useDynamicForm():
 *   <DynamicForm form={form} />                    // all copies + buttons
 *   <DynamicForm form={form} schema={otherNodes} /> // another schema sharing the form's actions,
 *                                                   // element state and language (e.g. a toolbar)
 * className (optional) wraps the output in a <div>.
 */
export const DynamicForm = ({ form, schema, className }) => {
  const nodes = schema ?? form.fullSchema;
  const content = nodes.map((node) => <LayoutParser key={node.id} node={node} {...form.parserProps} />);
  return (
    <I18nContext.Provider value={form.t}>
      {className ? <div className={className}>{content}</div> : content}
    </I18nContext.Provider>
  );
};
