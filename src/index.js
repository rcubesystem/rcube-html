// rcube-html public API
import { ensureStyles } from "./styles";

// The stylesheet: added once in the browser unless the page loaded "rcube-html/styles.css" itself
if (typeof window !== "undefined") ensureStyles();

export { ensureStyles, RCUBE_HTML_CSS } from "./styles";
// rcube-html's own building blocks (no Bootstrap): for components registered with registerComponent
export {
  Button, ButtonGroup, CloseButton, Form, Spinner as UiSpinner, Badge as UiBadge, ProgressBar as UiProgressBar, Card as UiCard,
  Table, Image, Pagination, Dropdown, Modal as UiModal, Overlay, Container, Row, Col, colClasses, gapClasses, cx,
} from "./ui";
export { useDynamicTag } from "./useDynamicTag";
export { DynamicTag } from "./DynamicTag";
export { LayoutParser, ComponentRegistry, registerComponent } from "./html";
export {
  InputField, TextareaField, SelectField, RadioGroupField, CheckboxGroupField, SliderField, ButtonField,
  createFormActions, validateField, getFieldValue, setFieldDomValue, getFormEntries,
  collectFieldProps, childNodesOf, cloneSchema, isNodeVisible, applyMask, runAction, resolveEventProps, FIELD_TYPES,
  findNode, validateTables,
} from "./form";
export { DataTable, formatValue, matchesRule, configureTableLook } from "./table";
export { Chart, CHART_COLORS } from "./chart";
export { Calendar } from "./calendar";
export { FileUploadField, uploadWithXhr, formatBytes, parseSize } from "./upload";
export { Tree } from "./tree";
export { RichText, RichTextField, RICH_TEXT_TOOLBAR } from "./richtext";
export { configureViewStore, viewStoreSettings, readView, saveView, clearView, hasView, clearAllViews, purgeExpiredViews, VIEW_STORE_EVENT } from "./viewStore";
export { cleanHtml, htmlToText, isHtml, escapeHtml, richTextHtml, RICH_TEXT_TAGS } from "./richtextUtils";
export { TREE_VIEWS, findTreeNode, mapTreeNode, insertTreeNode, removeTreeNode, moveTreeNode, walkTree } from "./treeUtils";
export { CALENDAR_VIEWS, rangeOf as calendarRange, normalizeEvent, expandEvents } from "./calendarUtils";
export { validateCellValue, TABLE_TYPES } from "./tableUtils";
export {
  Card, Accordion, Tabs, Modal, Carousel, Tooltip, Popover, Alert,
  Badge, Breadcrumb, ProgressBar, Spinner, ListGroup, REVEAL_EVENT,
} from "./components";
export { createTranslator, defaultTranslator, I18nContext, useTranslator, translateText, translateProps } from "./i18n";
