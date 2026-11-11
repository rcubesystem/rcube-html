import { InputField, TextareaField, SelectField, RadioGroupField, CheckboxGroupField, SliderField, ButtonField, isNodeVisible, getFieldValue, setFieldDomValue, resolveEventProps, FIELD_TYPES } from './form';
import { translateProps, useTranslator } from './i18n';
import { BUILT_IN_CONTAINERS, BUILT_IN_DISPLAY } from './components';
import { DataTable } from './table';
import { Chart } from './chart';
import { Calendar } from './calendar';
import { FileUploadField } from './upload';
import { Tree } from './tree';
import { RichText, RichTextField } from './richtext';
import { Container, Row, Col, Image } from "./ui";

// 1. Define UI components to resolve inside the layout

// Text Component: one component for every text tag (h1-h6, p, span, ...)
// Schema: { "type": "Text", "props": { "tag": "h3", "text": "Title" } } or a registry alias like { "type": "H3" }
const TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'label', 'blockquote'];

const Text = ({ tag = 'p', children, text, functionMap, ...props }) => {
  const Tag = TEXT_TAGS.includes(String(tag).toLowerCase()) ? String(tag).toLowerCase() : 'p';
  return <Tag {...props}>{text ?? children}</Tag>;
};

// Registry aliases: H1 ... H6, P, SPAN, etc. all render Text with their tag
const textAliases = Object.fromEntries(
  TEXT_TAGS.map((tag) => [tag.toUpperCase(), (props) => <Text {...props} tag={tag} />])
);

// <div> Box Container Component (useful for nested layout sections)
const DIV = ({ children, ...props }) => <div {...props}>{children}</div>;

// <a> Anchor Link Component
const A = ({ children, text, href = '#', ...props }) => <a href={href} {...props}>{text || children}</a>;

// <img> Image Component
const IMG = ({ src, alt = '', ...props }) => <Image src={src} alt={alt} fluid rounded {...props} />;


// <ul> & <li> List Components
const LIST = ({ items = [], children, ...props }) => (
  <ul {...props}>
    {items.length > 0
      ? items.map((item, index) => <li key={index}>{typeof item === 'string' ? item : item.text}</li>)
      : children
    }
  </ul>
);

// 2. Map string keys to literal React components
const ComponentRegistry = {
  Text,
  ...textAliases, // H1, H2, H3, H4, H5, H6, P, SPAN, SMALL, STRONG, EM, LABEL, BLOCKQUOTE
  A, IMG, DIV, LIST,
  ...BUILT_IN_DISPLAY,    // Badge, Breadcrumb, ProgressBar, Spinner, ListGroup
  ...BUILT_IN_CONTAINERS, // Card, Accordion, Tabs, Modal, Dialog, Carousel, Tooltip, Popover, Alert
  DataTable,
  DynamicTable: DataTable,
  Chart,
  Calendar,
  Tree,
  RichText,
  RichTextField,
  InputField,
  TextareaField,
  SelectField,
  RadioGroupField,
  CheckboxGroupField,
  SliderField,
  FileUploadField,
  FileUpload: FileUploadField,
  ButtonField
};

// Components built with forwardRef whose DOM node gets stored in fieldRefs (shared with form.js)
const RefFields = FIELD_TYPES;

// Fields that also get the form's actions (to run schema action names from their own options, e.g. RichTextField tools)
const ActionFields = new Set(['RichTextField']);

// Components that render nested schema nodes (node.children / node.items[].children / node.footer)
// (DataTable, Chart, Calendar and Tree get the same props so they can reach the form's actions, errors and change tracking)
const ContainerTypes = new Set([...Object.keys(BUILT_IN_CONTAINERS), 'DataTable', 'DynamicTable', 'Chart', 'Calendar', 'Tree']);

/**
 * Add a project-specific component to the registry so schemas can use it by name:
 *   registerComponent('Rating', RatingComponent);                       // display component
 *   registerComponent('RatingField', RatingField, { field: true });     // form field
 *   registerComponent('Panel', Panel, { container: true });             // renders nested nodes
 *   registerComponent('NoteField', NoteField, { field: true, actions: true }); // a field that also gets `actions`
 * Field components must forwardRef to their input element (or a <fieldset> for groups) so the
 * form can read, set and validate their value; they receive name, error and onChange props.
 * Container components receive node, nodeId, items, renderNodes, actions and formContext
 * ({ errors, onFieldChange, values }) (see components.js);
 * render nested nodes with renderNodes(node.children) or renderNodes(item.children).
 */
export const registerComponent = (name, component, { field = false, container = false, actions = false } = {}) => {
  ComponentRegistry[name] = component;
  if (field) FIELD_TYPES.add(name);
  if (field && actions) ActionFields.add(name);
  if (container) ContainerTypes.add(name);
};

// Merge a node's runtime state into a copy of it: override props (style merged), and add the
// rc-d-none class when hidden so the element stays mounted (fields keep their values) but isn't shown
const applyNodeState = (node, { props: overrides = {}, hidden } = {}) => {
  const props = {
    ...node.props,
    ...overrides,
    ...((node.props?.style || overrides.style) && { style: { ...node.props?.style, ...overrides.style } }),
  };
  if (hidden) props.className = `${props.className || ''} rc-d-none`.trim();
  return { ...node, props };
};

// 3. Recursive Layout Parser Engine
// fieldRefs: a useRef({}) owned by the calling component, filled as { [fieldName]: DOM element }
// errors: { [fieldName]: message } shown under each field
// onFieldChange(event, fieldName, value): called on every field edit; value is the whole field's
//   current value (array for checkbox groups)
// values: { [fieldName]: value } used to evaluate each node's "visibleWhen" rule
// pendingValues: useRef({}) of values set in code (formData / setFormData) that a field applies
//   when it renders — covers fields that were hidden or waiting on a dependent select
// nodeState: { [nodeId]: { hidden, removed, props } } — runtime changes made by formActions
//   (setNodeProps / hideNode / showNode / toggleNode / removeNode / restoreNode)
// nested: set internally so only top-level rows get wrapped in a <Container>
const LayoutParser = ({ node: schemaNode, functionMap, fieldRefs, errors, onFieldChange, values, pendingValues, nodeState, nested = false }) => {
  // The form's translator, provided by <DynamicTag> (library English outside a form)
  const t = useTranslator();
  if (!schemaNode) return null;

  // Hidden nodes are not rendered, so their fields drop out of fieldRefs and validation
  if (!isNodeVisible(schemaNode.visibleWhen, values)) return null;

  // Runtime element changes: removed -> not rendered; props / hidden -> merged into the node
  const dynamic = nodeState?.[schemaNode.id];
  if (dynamic?.removed) return null;
  const changedNode = dynamic ? applyNodeState(schemaNode, dynamic) : schemaNode;
  // "@key" strings in props (labels, placeholders, messages, option labels) -> active language text
  const node = changedNode.props ? { ...changedNode, props: translateProps(changedNode.props, t) } : changedNode;

  const childProps = { functionMap, fieldRefs, errors, onFieldChange, values, pendingValues, nodeState, nested: true };

  // Handle structural Row container
  //   { "type": "row", "props": { "gap": 3 | { "x": 2, "y": 3 }, "className": "..." }, "children": [ columns ] }
  if (node.type === 'row') {
    const row = (
      <Row gap={node.props?.gap} className={node.props?.className} style={node.props?.style}>
        {node.children?.map((child) => (
          <LayoutParser key={child.id} node={child} {...childProps} />
        ))}
      </Row>
    );
    return nested ? row : <Container>{row}</Container>;
  }

  // Handle structural Column container
  //   { "type": "column", "props": { "span": 6 | "auto" | { "xs": 12, "md": 6, "lg": 4 }, "className": "..." } }
  //   no span: equal widths (or the widths its className gives, e.g. Bootstrap's "col-md-6" where Bootstrap is loaded)
  if (node.type === 'column') {
    return (
      <Col span={node.props?.span} className={node.props?.className} style={node.props?.style}>
        {node.children?.map((child) => (
          <LayoutParser key={child.id} node={child} {...childProps} />
        ))}
      </Col>
    );
  }

  const componentName = node.type === 'component' ? node.componentName : node.type;
  const ComponentToRender = ComponentRegistry[componentName];
  if (!ComponentToRender) {
    return <div className="rc-text-danger">{t('layout.componentNotFound', { name: componentName })}</div>;
  }

  if (RefFields.has(componentName)) {
    const fieldName = node.props?.name || node.id;
    // Read from the field's ref so groups report all checked options, not just the clicked one
    const readValue = (e) => getFieldValue(fieldRefs?.current[fieldName] || e.target);

    // Context passed as the 2nd argument to every custom handler:
    //   actions: { zipChanged: (event, { name, value, values, fieldRefs }) => { ... } }
    // value is fresh; values is the snapshot from the last render
    const getContext = (e) => ({ name: fieldName, value: readValue(e), values, fieldRefs });

    // Schema events ("onBlur": "zipBlurred()", "onFocus": ..., "onKeyDown": ...) -> formActions functions
    const { onChange: customOnChange, ...customEvents } = resolveEventProps(node.props, functionMap, getContext);

    return (
      <ComponentToRender
        {...node.props}
        {...customEvents}
        name={fieldName}
        // SelectField reads other fields' values for dependent options ("optionsFrom")
        {...(componentName === 'SelectField' && { formValues: values })}
        // Fields with their own schema actions (RichTextField tools / onLink) run them through the form
        {...(ActionFields.has(componentName) && { actions: functionMap })}
        error={errors?.[fieldName]}
        onChange={(e) => {
          // Built-in tracking (visibleWhen, optionsFrom, error clearing) first, then the schema's onChange
          onFieldChange?.(e, fieldName, readValue(e));
          customOnChange?.(e);
        }}
        ref={(el) => {
          if (!fieldRefs) return;
          if (!el) {
            delete fieldRefs.current[fieldName];
            return;
          }
          fieldRefs.current[fieldName] = el;
          // Apply a value set in code before the user has edited this field
          if (pendingValues?.current && fieldName in pendingValues.current) {
            setFieldDomValue(el, pendingValues.current[fieldName], node.props);
          }
        }}
      />
    );
  }

  // Non-field components: schema events (e.g. "onClick": "resetForm()") resolve the same way
  const events = resolveEventProps(node.props, functionMap, () => ({ name: node.id, values, fieldRefs }));

  // Containers render nested schema nodes with the same form context (fields inside keep validation,
  // values, events and translation)
  if (ContainerTypes.has(componentName)) {
    const renderNodes = (nodes = []) => nodes.map((child) => (
      <LayoutParser key={child.id} node={child} {...childProps} />
    ));
    return (
      <ComponentToRender
        {...node.props}
        {...events}
        node={node}
        nodeId={node.id}
        items={node.items ? translateProps(node.items, t) : undefined}
        renderNodes={renderNodes}
        actions={functionMap}
        formContext={{ errors, onFieldChange, values }}
      />
    );
  }

  return <ComponentToRender {...node.props} {...events} />;
};

export { LayoutParser, ComponentRegistry };
