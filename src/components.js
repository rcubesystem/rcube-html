import { useEffect, useRef, useState } from "react";
import {
  Accordion as BsAccordion, Alert as BsAlert, Badge as BsBadge, Breadcrumb as BsBreadcrumb,
  Card as BsCard, Carousel as BsCarousel, ListGroup as BsListGroup, OverlayTrigger,
  Popover as BsPopover, ProgressBar as BsProgressBar, Spinner as BsSpinner, Tab, Tabs as BsTabs,
  Tooltip as BsTooltip,
} from "react-bootstrap";
import { useTranslator } from "./i18n";

/*
 * Bootstrap components for schemas.
 *
 * Container components render other schema nodes and receive, from LayoutParser:
 *   node        - the schema node (children / items / footer hold nested schema nodes)
 *   nodeId      - node.id
 *   items       - node.items with "@key" text translated
 *   renderNodes - (nodes) => rendered schema nodes (fields inside keep validation, values, events)
 *   actions     - the form's actions (setNodeProps, hideNode, ...)
 * plus the node's translated props and resolved schema events.
 */

// Event fired on a field before it is focused after a failed validation; Tabs / Accordion open
// the pane that contains it. Panes are marked data-rcube-pane, containers data-rcube-container.
export const REVEAL_EVENT = 'rcube:reveal';

const useRevealPane = (reveal) => {
  const ref = useRef(null);
  const revealRef = useRef(reveal);
  revealRef.current = reveal;
  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const handler = (event) => {
      // Nearest pane that belongs to this container (skips panes of nested containers)
      let pane = event.target.closest?.('[data-rcube-pane]');
      while (pane && pane.closest('[data-rcube-container]') !== root) {
        pane = pane.parentElement?.closest('[data-rcube-pane]');
      }
      if (pane) revealRef.current(pane.getAttribute('data-rcube-pane'));
    };
    root.addEventListener(REVEAL_EVENT, handler);
    return () => root.removeEventListener(REVEAL_EVENT, handler);
  }, []);
  return ref;
};

// Keep a container's open pane in local state, following activeKey from the schema / setNodeProps.
// activeKeyRequest changes force a re-sync when the same key is requested again (selectTab).
const useActiveKey = (activeKey, defaultActiveKey, fallback, activeKeyRequest) => {
  const [active, setActive] = useState(activeKey ?? defaultActiveKey ?? fallback);
  useEffect(() => {
    if (activeKey !== undefined) setActive(activeKey);
  }, [activeKey, activeKeyRequest]);
  return [active, setActive];
};

// ---------------------------------------------------------------- containers

/**
 * Card — title / content / header / footer / image props, plus optional child nodes in the body.
 * { "type": "Card", "id": "c1", "props": { "title": "...", "content": "...", "header": "...", "footer": "...",
 *   "imgSrc": "...", "imgAlt": "..." }, "children": [ ...nodes... ] }
 */
export const Card = ({ node, renderNodes, title, content, header, footer, imgSrc, imgAlt = '', className = '', bodyClassName, style }) => (
  <BsCard className={className} style={style}>
    {header && <BsCard.Header>{header}</BsCard.Header>}
    {imgSrc && <BsCard.Img variant="top" src={imgSrc} alt={imgAlt} />}
    <BsCard.Body className={bodyClassName}>
      {title && <BsCard.Title>{title}</BsCard.Title>}
      {content && <BsCard.Text>{content}</BsCard.Text>}
      {renderNodes?.(node?.children)}
    </BsCard.Body>
    {footer && <BsCard.Footer>{footer}</BsCard.Footer>}
  </BsCard>
);

/**
 * Accordion — one panel per item; panels can hold fields (kept mounted while collapsed).
 * { "type": "Accordion", "id": "faq", "props": { "defaultActiveKey": "a", "alwaysOpen": false, "flush": false },
 *   "items": [ { "key": "a", "title": "...", "children": [ ...nodes... ] } ] }
 * onSelect (schema event) receives { eventKey }.
 */
export const Accordion = ({ items = [], renderNodes, activeKey, activeKeyRequest, defaultActiveKey, alwaysOpen = false, flush, onSelect, className = '', style }) => {
  const [active, setActive] = useActiveKey(activeKey, defaultActiveKey, alwaysOpen ? [] : undefined, activeKeyRequest);
  const ref = useRevealPane((key) => setActive((prev) => {
    if (!alwaysOpen) return key;
    const open = Array.isArray(prev) ? prev : prev != null ? [prev] : [];
    return open.includes(key) ? open : [...open, key];
  }));
  return (
    <div ref={ref} data-rcube-container="" className={className} style={style}>
      <BsAccordion
        activeKey={active}
        alwaysOpen={alwaysOpen}
        flush={flush}
        onSelect={(eventKey, event) => { setActive(eventKey); onSelect?.({ eventKey, nativeEvent: event }); }}
      >
        {items.map((item) => (
          <BsAccordion.Item key={item.key} eventKey={String(item.key)}>
            <BsAccordion.Header>{item.title}</BsAccordion.Header>
            <BsAccordion.Body>
              <div data-rcube-pane={item.key}>{renderNodes(item.children)}</div>
            </BsAccordion.Body>
          </BsAccordion.Item>
        ))}
      </BsAccordion>
    </div>
  );
};

/**
 * Tabs — one tab per item; tabs can hold fields (all panes stay mounted, so values are kept and
 * fields in other tabs are validated; Submit opens the tab with the first error).
 * { "type": "Tabs", "id": "t1", "props": { "defaultActiveKey": "a", "variant": "tabs", "fill": false },
 *   "items": [ { "key": "a", "title": "...", "disabled": false, "children": [ ...nodes... ] } ] }
 * Switch from code: actions.selectTab("t1", "b"). onSelect (schema event) receives { eventKey }.
 */
export const Tabs = ({ nodeId, items = [], renderNodes, activeKey, activeKeyRequest, defaultActiveKey, variant = 'tabs', fill, justify, onSelect, className = '', style }) => {
  const [active, setActive] = useActiveKey(activeKey, defaultActiveKey, items[0]?.key, activeKeyRequest);
  const ref = useRevealPane((key) => setActive(key));
  return (
    <div ref={ref} data-rcube-container="" className={className} style={style}>
      <BsTabs
        id={nodeId}
        activeKey={active}
        variant={variant}
        fill={fill}
        justify={justify}
        className="mb-3"
        onSelect={(eventKey, event) => { setActive(eventKey); onSelect?.({ eventKey, nativeEvent: event }); }}
      >
        {items.map((item) => (
          <Tab key={item.key} eventKey={item.key} title={item.title} disabled={item.disabled}>
            <div data-rcube-pane={item.key}>{renderNodes(item.children)}</div>
          </Tab>
        ))}
      </BsTabs>
    </div>
  );
};

/**
 * Modal (also registered as "Dialog") — opened / closed through the form's element state.
 * { "type": "Modal", "id": "m1", "props": { "title": "...", "show": false, "size": "lg", "centered": true,
 *   "scrollable": false, "backdrop": true | "static", "keyboard": true, "closeButton": true },
 *   "children": [ ...body nodes... ], "footer": [ ...footer nodes... ] }
 * Open: actions.openModal("m1") or a button { "data-modal": "m1", "onClick": "openModal()" }.
 * The modal stays in the page while closed (hidden), so fields inside keep their values;
 * fields in a closed modal are not validated. onHide (schema event) runs when it closes itself.
 */
export const Modal = ({ nodeId, node, renderNodes, actions, show = false, title, size, centered, scrollable,
  backdrop = true, keyboard = true, closeButton = true, onHide, className = '', style }) => {
  const t = useTranslator();
  const closeRef = useRef(null);
  closeRef.current = (event) => {
    actions?.setNodeProps?.(nodeId, { show: false });
    onHide?.(event);
  };

  // Escape closes; body scroll is locked while open
  useEffect(() => {
    if (!show) return undefined;
    document.body.classList.add('modal-open');
    const onKey = (event) => { if (keyboard && event.key === 'Escape') closeRef.current(event); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('modal-open');
      document.removeEventListener('keydown', onKey);
    };
  }, [show, keyboard]);

  const dialogClass = ['modal-dialog', size && `modal-${size}`, centered && 'modal-dialog-centered',
    scrollable && 'modal-dialog-scrollable'].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={`modal ${show ? 'd-block' : 'd-none'} ${className}`.trim()}
        style={style}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? `${nodeId}-title` : undefined}
        onMouseDown={(event) => {
          if (backdrop === true && event.target === event.currentTarget) closeRef.current(event);
        }}
      >
        <div className={dialogClass}>
          <div className="modal-content">
            {(title || closeButton) && (
              <div className="modal-header">
                {title && <h5 className="modal-title" id={`${nodeId}-title`}>{title}</h5>}
                {closeButton && (
                  <button type="button" className="btn-close" aria-label={t('common.close')} onClick={(event) => closeRef.current(event)} />
                )}
              </div>
            )}
            <div className="modal-body">{renderNodes(node?.children)}</div>
            {node?.footer?.length > 0 && <div className="modal-footer">{renderNodes(node.footer)}</div>}
          </div>
        </div>
      </div>
      {show && backdrop && <div className="modal-backdrop show" />}
    </>
  );
};

/**
 * Carousel — slides from items: image (src / alt), caption / text, or child nodes.
 * { "type": "Carousel", "id": "hero", "props": { "interval": 5000, "controls": true, "indicators": true, "fade": false },
 *   "items": [ { "src": "...", "alt": "...", "caption": "...", "text": "..." }, { "children": [ ...nodes... ] } ] }
 * "interval": null stops auto-play.
 */
export const Carousel = ({ items = [], renderNodes, interval = 5000, controls = true, indicators = true, fade, className = '', style }) => (
  <BsCarousel interval={interval} controls={controls} indicators={indicators} fade={fade} className={className} style={style}>
    {items.map((item, index) => (
      <BsCarousel.Item key={item.key ?? index}>
        {item.src && <img className="d-block w-100" src={item.src} alt={item.alt || ''} />}
        {item.children && renderNodes(item.children)}
        {(item.caption || item.text) && (
          <BsCarousel.Caption>
            {item.caption && <h5>{item.caption}</h5>}
            {item.text && <p>{item.text}</p>}
          </BsCarousel.Caption>
        )}
      </BsCarousel.Item>
    ))}
  </BsCarousel>
);

/**
 * Tooltip — hover / focus hint around child nodes (or a plain "label").
 * { "type": "Tooltip", "id": "tip", "props": { "text": "...", "placement": "top", "wrapperClassName": "d-inline-block" },
 *   "children": [ ...nodes... ] }
 * Use "wrapperClassName": "d-block" to wrap a full-width field.
 */
export const Tooltip = ({ nodeId, node, renderNodes, text, placement = 'top', label, wrapperClassName = 'd-inline-block' }) => {
  const hasChildren = node?.children?.length > 0;
  return (
    <OverlayTrigger placement={placement} overlay={<BsTooltip id={`${nodeId}-tooltip`}>{text}</BsTooltip>}>
      <div className={wrapperClassName} tabIndex={hasChildren ? undefined : 0}>
        {hasChildren ? renderNodes(node.children) : label}
      </div>
    </OverlayTrigger>
  );
};

/**
 * Popover — click (default) / hover / focus panel with a title and text, around child nodes.
 * { "type": "Popover", "id": "pop", "props": { "title": "...", "text": "...", "placement": "right",
 *   "trigger": "click" | "hover" | "focus", "wrapperClassName": "d-inline-block" }, "children": [ ...nodes... ] }
 */
export const Popover = ({ nodeId, node, renderNodes, title, text, placement = 'right', trigger = 'click', label, wrapperClassName = 'd-inline-block' }) => {
  const hasChildren = node?.children?.length > 0;
  const overlay = (
    <BsPopover id={`${nodeId}-popover`}>
      {title && <BsPopover.Header as="h3">{title}</BsPopover.Header>}
      <BsPopover.Body>{text}</BsPopover.Body>
    </BsPopover>
  );
  return (
    <OverlayTrigger trigger={trigger === 'hover' ? ['hover', 'focus'] : trigger} placement={placement} overlay={overlay} rootClose>
      <div className={wrapperClassName} tabIndex={hasChildren ? undefined : 0}>
        {hasChildren ? renderNodes(node.children) : label}
      </div>
    </OverlayTrigger>
  );
};

/**
 * Alert — message box; optional heading, text and child nodes. "dismissible" adds a close button
 * that hides the node (actions.showNode(id) brings it back). onClose (schema event) runs on close.
 * { "type": "Alert", "id": "a1", "props": { "variant": "warning", "heading": "...", "text": "...", "dismissible": true } }
 */
export const Alert = ({ nodeId, node, renderNodes, actions, variant = 'info', heading, text, dismissible, onClose, className = '', style }) => {
  const t = useTranslator();
  return (
    <BsAlert
      // Always "shown" for React-Bootstrap; closing hides the node via element state instead, so
      // actions.showNode(id) can bring it back (React-Bootstrap's own state would unmount it for good)
      show
      variant={variant}
      dismissible={dismissible}
      closeLabel={t('common.close')}
      onClose={(event) => { actions?.hideNode?.(nodeId); onClose?.(event); }}
      className={className}
      style={style}
    >
      {heading && <BsAlert.Heading>{heading}</BsAlert.Heading>}
      {text && <p className="mb-0">{text}</p>}
      {renderNodes(node?.children)}
    </BsAlert>
  );
};

// Components that render nested schema nodes (LayoutParser passes them renderNodes / node / items)
export const BUILT_IN_CONTAINERS = { Card, Accordion, Tabs, Modal, Dialog: Modal, Carousel, Tooltip, Popover, Alert };

// ---------------------------------------------------------------- display components (props only)

/** { "type": "Badge", "id": "b1", "props": { "text": "New", "bg": "success", "pill": true, "textColor": "dark" } } */
export const Badge = ({ text, bg = 'primary', pill, textColor, ...props }) => (
  <BsBadge bg={bg} pill={pill} text={textColor} {...props}>{text}</BsBadge>
);

/** { "type": "Breadcrumb", "id": "bc", "props": { "items": [ { "text": "Home", "href": "/" }, { "text": "Profile", "active": true } ] } } */
export const Breadcrumb = ({ items = [], ...props }) => (
  <BsBreadcrumb {...props}>
    {items.map((item, index) => (
      <BsBreadcrumb.Item key={index} href={item.active ? undefined : item.href} active={item.active}>{item.text}</BsBreadcrumb.Item>
    ))}
  </BsBreadcrumb>
);

/** { "type": "ProgressBar", "id": "p1", "props": { "now": 60, "min": 0, "max": 100, "showLabel": true, "variant": "success", "striped": true, "animated": true } } */
export const ProgressBar = ({ now = 0, min = 0, max = 100, label, showLabel, ...props }) => {
  const percent = max > min ? Math.round(((now - min) / (max - min)) * 100) : 0;
  return <BsProgressBar now={now} min={min} max={max} label={label ?? (showLabel ? `${percent}%` : undefined)} {...props} />;
};

/** { "type": "Spinner", "id": "s1", "props": { "animation": "border" | "grow", "variant": "primary", "size": "sm", "text": "Loading..." } } */
export const Spinner = ({ animation = 'border', text, ...props }) => {
  const t = useTranslator();
  return (
    <BsSpinner animation={animation} role="status" {...props}>
      <span className="visually-hidden">{text || t('common.loading')}</span>
    </BsSpinner>
  );
};

/**
 * { "type": "ListGroup", "id": "lg", "props": { "flush": false, "numbered": false, "horizontal": false,
 *   "items": [ { "text": "...", "href": "...", "active": false, "disabled": false, "variant": "info", "badge": "3", "badgeBg": "primary" } ] } }
 */
export const ListGroup = ({ items = [], ...props }) => (
  <BsListGroup {...props}>
    {items.map((item, index) => (
      <BsListGroup.Item
        key={index}
        action={Boolean(item.href)}
        href={item.href}
        active={item.active}
        disabled={item.disabled}
        variant={item.variant}
        className="d-flex justify-content-between align-items-center"
      >
        {item.text}
        {item.badge != null && <BsBadge bg={item.badgeBg || 'primary'} pill>{item.badge}</BsBadge>}
      </BsListGroup.Item>
    ))}
  </BsListGroup>
);

export const BUILT_IN_DISPLAY = { Badge, Breadcrumb, ProgressBar, Spinner, ListGroup };
