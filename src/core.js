// rcube-html/core: forms, layout, containers, display components, actions, i18n and styles — without the DataTable,
// Chart, Calendar, Tree, RichText / RichTextField and FileUploadField, which each have an entry point of their own:
//   import { useDynamicTag, DynamicTag } from "rcube-html/core";
//   import "rcube-html/table";        // adds DataTable to schemas (and exports it)
// 'rcube-html' itself is core + all of them.
import { ensureStyles } from "./styles";

// The stylesheet: added once in the browser unless the page loaded "rcube-html/styles.css" itself
if (typeof window !== "undefined") ensureStyles();

export { ensureStyles, RCUBE_HTML_CSS } from "./styles";
// rcube-html's own building blocks (they work with any CSS framework): for components registered with registerComponent
export {
  Button, ButtonGroup, CloseButton, Form, Spinner as UiSpinner, Badge as UiBadge, ProgressBar as UiProgressBar, Card as UiCard,
  Table, Image, Pagination, Dropdown, Modal as UiModal, Overlay, Container, Row, Col, colClasses, gapClasses, cx,
} from "./ui";
export { useDynamicTag } from "./useDynamicTag";
export { normalizeSchema, childrenOf, asList, schemaIds } from "./schema";
export { DynamicTag } from "./DynamicTag";
export { LayoutParser, ComponentRegistry, registerComponent } from "./html";
export {
  InputField, TextareaField, SelectField, RadioGroupField, CheckboxGroupField, SliderField, ButtonField,
  createFormActions, validateField, getFieldValue, setFieldDomValue, getFormEntries,
  collectFieldProps, childNodesOf, cloneSchema, isNodeVisible, applyMask, runAction, resolveEventProps, FIELD_TYPES,
  findNode, validateTables,
} from "./form";
export { configureViewStore, viewStoreSettings, readView, saveView, clearView, hasView, clearAllViews, purgeExpiredViews, VIEW_STORE_EVENT } from "./viewStore";
export { cleanHtml, htmlToText, isHtml, escapeHtml, richTextHtml, RICH_TEXT_TAGS } from "./richtextUtils";
export { TREE_VIEWS, findTreeNode, mapTreeNode, insertTreeNode, removeTreeNode, moveTreeNode, walkTree } from "./treeUtils";
export { CALENDAR_VIEWS, rangeOf as calendarRange, normalizeEvent, expandEvents } from "./calendarUtils";
export { validateCellValue, TABLE_TYPES, formatValue, matchesRule } from "./tableUtils";
export { CHART_COLORS } from "./palette";
export { formatBytes } from "./uploadUtils";
export {
  Card, Accordion, Tabs, Modal, Carousel, Tooltip, Popover, Alert,
  Badge, Breadcrumb, ProgressBar, Spinner, ListGroup, REVEAL_EVENT,
} from "./components";
export { createTranslator, defaultTranslator, I18nContext, useTranslator, translateText, translateProps } from "./i18n";
