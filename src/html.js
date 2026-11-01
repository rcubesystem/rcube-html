import { InputField, TextareaField, SelectField, RadioGroupField, CheckboxGroupField, ButtonField, isNodeVisible, getFieldValue, setFieldDomValue, resolveEventProps, FIELD_TYPES } from './form';
import { translateProps, useTranslator } from './i18n';
import { Container, Row, Col, Card as BsCard, Image } from "react-bootstrap";

// 1. Define UI components to resolve inside the layout  
const Card = ({ title, content, className = '' }) => (
  <BsCard className={className}>
    <BsCard.Body>
      <BsCard.Title>{title}</BsCard.Title>
      <BsCard.Text>{content}</BsCard.Text>
    </BsCard.Body>
  </BsCard>
);
 

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
  Card,
  Text,
  ...textAliases, // H1, H2, H3, H4, H5, H6, P, SPAN, SMALL, STRONG, EM, LABEL, BLOCKQUOTE
  A, IMG, DIV, LIST,
  InputField,
  TextareaField,
  SelectField,
  RadioGroupField,
  CheckboxGroupField,
  ButtonField
};

// Components built with forwardRef whose DOM node gets stored in fieldRefs (shared with form.js)
const RefFields = FIELD_TYPES;

/**
 * Add a project-specific component to the registry so schemas can use it by name:
 *   registerComponent('Rating', RatingComponent);                       // display component
 *   registerComponent('RatingField', RatingField, { field: true });     // form field
 * Field components must forwardRef to their input element (or a <fieldset> for groups) so the
 * form can read, set and validate their value; they receive name, error and onChange props.
 */
export const registerComponent = (name, component, { field = false } = {}) => {
  ComponentRegistry[name] = component;
  if (field) FIELD_TYPES.add(name);
};

// Merge a node's runtime state into a copy of it: override props (style merged), and add Bootstrap's
// d-none class when hidden so the element stays mounted (fields keep their values) but isn't shown
const applyNodeState = (node, { props: overrides = {}, hidden } = {}) => {
  const props = {
    ...node.props,
    ...overrides,
    ...((node.props?.style || overrides.style) && { style: { ...node.props?.style, ...overrides.style } }),
  };
  if (hidden) props.className = `${props.className || ''} d-none`.trim();
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
  if (node.type === 'row') {
    const row = (
      <Row className={node.props?.className}>
        {node.children?.map((child) => (
          <LayoutParser key={child.id} node={child} {...childProps} />
        ))}
      </Row>
    );
    return nested ? row : <Container>{row}</Container>;
  }

  // Handle structural Column container
  if (node.type === 'column') {
    return (
      <Col className={node.props?.className}>
        {node.children?.map((child) => (
          <LayoutParser key={child.id} node={child} {...childProps} />
        ))}
      </Col>
    );
  }

  const componentName = node.type === 'component' ? node.componentName : node.type;
  const ComponentToRender = ComponentRegistry[componentName];
  if (!ComponentToRender) {
    return <div className="text-danger">{t('layout.componentNotFound', { name: componentName })}</div>;
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
  return <ComponentToRender {...node.props} {...events} />;
};

export { LayoutParser, ComponentRegistry };
