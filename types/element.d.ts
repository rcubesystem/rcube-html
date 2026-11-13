// Types for rcube-html/element, rcube-html/element/core, /table, /chart, /calendar, /tree, /richtext, /upload and the
// window.RcubeHtml global of dist/browser/rcube-html.js. The schema and the form api are typed loosely: a schema is
// JSON, and the api holds the built-in actions plus your own.

/** A schema node: { type, id?, props?, children? } (children: a list, or a single node as an object) */
export interface SchemaNode {
  type: string;
  id?: string;
  props?: Record<string, any>;
  children?: SchemaNode | SchemaNode[];
  [key: string]: any;
}
export type Schema = SchemaNode[];
/** Every form action: setFormData, getFormEntries, runValidation, setNodeProps, hideNode, … and your own */
export type FormApi = Record<string, (...args: any[]) => any>;
export type ActionMap = Record<string, (...args: any[]) => any>;
export type Actions = ActionMap | ((api: FormApi) => ActionMap);
export type Values = Record<string, any>;

/** The options of <rcube-form> (properties, Vue props, Angular inputs, mount() options) */
export interface FormOptions {
  schema?: Schema;
  buttons?: Schema;
  actions?: Actions;
  messages?: Record<string, any>;
  languages?: Record<string, any>;
  language?: string;
  data?: Values;
  repeatable?: boolean;
  values?: Values;
}

export interface ReadyDetail { api: FormApi }
export interface ChangeDetail { values: Values; entries: Values[] }
export interface SubmitDetail { entries: Values[]; values: Values }
export interface ActionDetail { name: string; event: any; context: any; api: FormApi }
export interface ErrorDetail { error: unknown }

/** The <rcube-form> element */
export interface RcubeFormElement extends HTMLElement, FormOptions {
  /** the form's actions, once it's on the page */
  readonly api: FormApi | undefined;
  /** resolves with the api when the form is on the page (also when that happened before) */
  readonly ready: Promise<FormApi>;
}
export declare const RcubeFormElement: { prototype: RcubeFormElement; new (): RcubeFormElement };

export interface MountOptions extends FormOptions {
  onSubmit?: (detail: SubmitDetail, event: CustomEvent<SubmitDetail>) => void;
  onChange?: (detail: ChangeDetail, event: CustomEvent<ChangeDetail>) => void;
  onAction?: (detail: ActionDetail, event: CustomEvent<ActionDetail>) => void;
  onReady?: (detail: ReadyDetail, event: CustomEvent<ReadyDetail>) => void;
  onError?: (detail: ErrorDetail, event: CustomEvent<ErrorDetail>) => void;
}

/** Puts a form into an element (a CSS selector or the element) and returns the <rcube-form> */
export declare function mount(target: string | Element, options?: MountOptions): RcubeFormElement;
/** Defines the element (rcube-html/element does it for <rcube-form>): another tag name, or again safely */
export declare function defineRcubeForm(tag?: string): void;
/** Makes a component usable in schemas: { type: name } (container: draws children; field: holds a value) */
export declare function registerComponent(name: string, component: any, options?: { field?: boolean; container?: boolean; actions?: boolean }): void;
export declare function normalizeSchema(nodes: SchemaNode | Schema | null | undefined, options?: { taken?: Iterable<string>; prefix?: string }): Schema;
export declare function childrenOf(node: SchemaNode | null | undefined): Schema;
export declare function asList<T>(value: T | T[] | null | undefined | false): T[];
export declare function schemaIds(nodes: Schema): Set<string>;
export declare function actionNamesIn(value: unknown, names?: Set<string>): Set<string>;
export declare const FORM_OPTIONS: string[];
/** The React inside the element: for components registered from Angular / Vue / plain pages */
export declare const React: any;
export declare const ComponentRegistry: Record<string, any>;
/** rcube-html's Spanish texts (dist/browser/rcube-html.js only: RcubeHtml.langEs) */
export declare const langEs: Record<string, any> | undefined;

// The rest of the library (as in React), typed loosely
export declare const Accordion: any, Alert: any, Badge: any, Breadcrumb: any, Button: any, ButtonField: any, ButtonGroup: any,
  CALENDAR_VIEWS: any, CHART_COLORS: any, Calendar: any, Card: any, Carousel: any, Chart: any, CheckboxGroupField: any,
  CloseButton: any, Col: any, Container: any, DataTable: any, Dropdown: any, DynamicTag: any, FIELD_TYPES: any,
  FileUploadField: any, Form: any, I18nContext: any, Image: any, InputField: any, LayoutParser: any, ListGroup: any,
  Modal: any, Overlay: any, Pagination: any, Popover: any, ProgressBar: any, RCUBE_HTML_CSS: string, REVEAL_EVENT: string,
  RICH_TEXT_TAGS: any, RICH_TEXT_TOOLBAR: any, RadioGroupField: any, RichText: any, RichTextField: any, Row: any,
  SelectField: any, SliderField: any, Spinner: any, TABLE_TYPES: any, TREE_VIEWS: any, Table: any, Tabs: any,
  TextareaField: any, Tooltip: any, Tree: any, UiBadge: any, UiCard: any, UiModal: any, UiProgressBar: any, UiSpinner: any,
  VIEW_STORE_EVENT: string;
export declare function applyMask(...args: any[]): any;
export declare function calendarRange(...args: any[]): any;
export declare function childNodesOf(...args: any[]): any;
export declare function cleanHtml(...args: any[]): any;
export declare function clearAllViews(...args: any[]): any;
export declare function clearView(...args: any[]): any;
export declare function cloneSchema(...args: any[]): any;
export declare function colClasses(...args: any[]): any;
export declare function collectFieldProps(...args: any[]): any;
export declare function configureTableLook(...args: any[]): any;
export declare function configureViewStore(...args: any[]): any;
export declare function createFormActions(...args: any[]): any;
export declare function createTranslator(...args: any[]): any;
export declare function cx(...args: any[]): string;
export declare function defaultTranslator(...args: any[]): any;
export declare function ensureStyles(...args: any[]): any;
export declare function escapeHtml(value: unknown): string;
export declare function expandEvents(...args: any[]): any;
export declare function findNode(...args: any[]): any;
export declare function findTreeNode(...args: any[]): any;
export declare function formatBytes(...args: any[]): string;
export declare function formatValue(...args: any[]): any;
export declare function gapClasses(...args: any[]): any;
export declare function getFieldValue(...args: any[]): any;
export declare function getFormEntries(...args: any[]): any;
export declare function hasView(...args: any[]): any;
export declare function htmlToText(...args: any[]): string;
export declare function insertTreeNode(...args: any[]): any;
export declare function isHtml(value: unknown): boolean;
export declare function isNodeVisible(...args: any[]): boolean;
export declare function mapTreeNode(...args: any[]): any;
export declare function matchesRule(...args: any[]): any;
export declare function moveTreeNode(...args: any[]): any;
export declare function normalizeEvent(...args: any[]): any;
export declare function parseSize(...args: any[]): any;
export declare function purgeExpiredViews(...args: any[]): any;
export declare function readView(...args: any[]): any;
export declare function removeTreeNode(...args: any[]): any;
export declare function resolveEventProps(...args: any[]): any;
export declare function richTextHtml(...args: any[]): any;
export declare function runAction(...args: any[]): any;
export declare function saveView(...args: any[]): any;
export declare function setFieldDomValue(...args: any[]): any;
export declare function translateProps(...args: any[]): any;
export declare function translateText(...args: any[]): any;
export declare function uploadWithXhr(...args: any[]): any;
export declare function useDynamicTag(...args: any[]): any;
export declare function useTranslator(...args: any[]): any;
export declare function validateCellValue(...args: any[]): any;
export declare function validateField(...args: any[]): any;
export declare function validateTables(...args: any[]): any;
export declare function viewStoreSettings(...args: any[]): any;
export declare function walkTree(...args: any[]): any;

declare global {
  interface HTMLElementTagNameMap {
    "rcube-form": RcubeFormElement;
  }
}
