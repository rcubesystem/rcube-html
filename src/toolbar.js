import { Button } from "./ui";
import { runAction } from "./form";

/*
 * Your own buttons on a component's toolbar — the same shape on DataTable, Calendar and Tree:
 *   "toolbarActions": [ { "text": "Approve", "onClick": "approve()", "variant": "success", "title": "...", "icon": "✓",
 *                         "needsSelection": true, "className": "...", "key": "approve" } ]
 * "onClick" runs a form action as fn(event, context); the context says what the component holds now (its selection,
 * view, date, ...). "needsSelection": off until something is picked (DataTable rows, Tree nodes).
 */
export const toolbarButtons = (items = [], actions, getContext, { hasSelection = true } = {}) => (items || []).map((item, i) => (
  <Button key={item.key ?? item.name ?? i} size="sm" variant={item.variant || 'outline-primary'} className={item.className}
    title={item.title} aria-label={item.title} disabled={item.disabled || (item.needsSelection && !hasSelection)}
    onClick={(event) => runAction(actions, item.onClick, event, getContext())}>
    {item.icon && <span aria-hidden="true" className={item.text ? 'rc-me-1' : undefined}>{item.icon}</span>}
    {item.text}
  </Button>
));
