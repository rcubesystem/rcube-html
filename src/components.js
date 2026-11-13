import { asList, childrenOf } from "./schema";
import { useEffect, useRef, useState } from "react";
import {
  Badge as UiBadge, Card as UiCard, CloseButton, Overlay, ProgressBar as UiProgressBar, Spinner as UiSpinner, cx, modalDialogClass, useModalBehavior,
} from "./ui";
import { useTranslator } from "./i18n";

/*
 * Components for schemas (rcube-html's own, styled by its stylesheet: they work with any CSS framework, including Bootstrap).
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
  <UiCard className={className} style={style}>
    {header && <UiCard.Header>{header}</UiCard.Header>}
    {imgSrc && <UiCard.Img variant="top" src={imgSrc} alt={imgAlt} />}
    <UiCard.Body className={bodyClassName}>
      {title && <UiCard.Title>{title}</UiCard.Title>}
      {content && <UiCard.Text>{content}</UiCard.Text>}
      {renderNodes?.(node?.children)}
    </UiCard.Body>
    {footer && <UiCard.Footer>{footer}</UiCard.Footer>}
  </UiCard>
);

/**
 * Accordion — one panel per item; panels can hold fields (kept mounted while collapsed).
 * { "type": "Accordion", "id": "faq", "props": { "defaultActiveKey": "a", "alwaysOpen": false, "flush": false },
 *   "items": [ { "key": "a", "title": "...", "children": [ ...nodes... ] } ] }
 * onSelect (schema event) receives { eventKey }.
 */
export const Accordion = ({ nodeId, items = [], renderNodes, activeKey, activeKeyRequest, defaultActiveKey, alwaysOpen = false, flush, onSelect, className = '', style }) => {
  const [active, setActive] = useActiveKey(activeKey, defaultActiveKey, alwaysOpen ? [] : undefined, activeKeyRequest);
  const ref = useRevealPane((key) => setActive((prev) => {
    if (!alwaysOpen) return key;
    const open = Array.isArray(prev) ? prev : prev != null ? [prev] : [];
    return open.includes(key) ? open : [...open, key];
  }));
  const openKeys = Array.isArray(active) ? active.map(String) : active != null ? [String(active)] : [];
  const toggle = (key, event) => {
    const k = String(key);
    const next = alwaysOpen
      ? (openKeys.includes(k) ? openKeys.filter((x) => x !== k) : [...openKeys, k])
      : (openKeys.includes(k) ? null : k);
    setActive(next);
    onSelect?.({ eventKey: next, nativeEvent: event });
  };
  return (
    <div ref={ref} data-rcube-container="" className={cx('rc-accordion', flush && 'rc-accordion-flush', className)} style={style}>
      {items.map((item) => {
        const open = openKeys.includes(String(item.key));
        const id = `${nodeId || 'accordion'}-${item.key}`;
        return (
          <div key={item.key} className="rc-accordion-item">
            <h2 className="rc-accordion-header">
              <button type="button" id={`${id}-btn`} className={cx('rc-accordion-button', !open && 'rc-collapsed')} aria-expanded={open}
                aria-controls={`${id}-pane`} onClick={(event) => toggle(item.key, event)}>
                {item.title}
              </button>
            </h2>
            {/* stays in the page while collapsed, so fields inside keep their values */}
            <div id={`${id}-pane`} role="region" aria-labelledby={`${id}-btn`} className="rc-accordion-collapse" hidden={!open}>
              <div className="rc-accordion-body"><div data-rcube-pane={item.key}>{renderNodes(item.children)}</div></div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Tabs — one tab per item; tabs can hold fields (all panes stay mounted, so values are kept and
 * fields in other tabs are validated; Submit opens the tab with the first error).
 * { "type": "Tabs", "id": "t1", "props": { "defaultActiveKey": "a", "variant": "tabs" | "pills" | "underline", "fill": false },
 *   "items": [ { "key": "a", "title": "...", "disabled": false, "children": [ ...nodes... ] } ] }
 * Switch from code: actions.selectTab("t1", "b"). onSelect (schema event) receives { eventKey }.
 */
export const Tabs = ({ nodeId, items = [], renderNodes, activeKey, activeKeyRequest, defaultActiveKey, variant = 'tabs', fill, justify, onSelect, className = '', style }) => {
  const [active, setActive] = useActiveKey(activeKey, defaultActiveKey, items[0]?.key, activeKeyRequest);
  const ref = useRevealPane((key) => setActive(key));
  const listRef = useRef(null);
  const select = (key, event) => { setActive(key); onSelect?.({ eventKey: key, nativeEvent: event }); };
  // Arrow keys move between tabs, Home / End go to the first / last
  const onKeyDown = (event) => {
    const enabled = items.filter((item) => !item.disabled);
    const i = enabled.findIndex((item) => String(item.key) === String(active));
    const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: enabled.length - 1 }[event.key];
    if (to === undefined || !enabled.length) return;
    event.preventDefault();
    const next = enabled[(to + enabled.length) % enabled.length];
    select(next.key, event);
    const tabs = [...(listRef.current?.querySelectorAll('[role="tab"]') || [])];
    tabs[items.indexOf(next)]?.focus();
  };
  return (
    <div ref={ref} data-rcube-container="" className={className} style={style}>
      <div ref={listRef} role="tablist" onKeyDown={onKeyDown}
        className={cx('rc-nav', `rc-nav-${variant}`, fill && 'rc-nav-fill', justify && 'rc-nav-justified', 'rc-mb-3')}>
        {items.map((item) => {
          const on = String(item.key) === String(active);
          return (
            <button key={item.key} type="button" role="tab" id={`${nodeId}-tab-${item.key}`} aria-selected={on}
              aria-controls={`${nodeId}-pane-${item.key}`} tabIndex={on ? 0 : -1} disabled={item.disabled}
              className={cx('rc-nav-link', on && 'rc-active')} onClick={(event) => select(item.key, event)}>
              {item.title}
            </button>
          );
        })}
      </div>
      {/* every pane stays mounted (values kept, fields validated); only the open one shows */}
      {items.map((item) => (
        <div key={item.key} role="tabpanel" id={`${nodeId}-pane-${item.key}`} aria-labelledby={`${nodeId}-tab-${item.key}`}
          hidden={String(item.key) !== String(active)}>
          <div data-rcube-pane={item.key}>{renderNodes(item.children)}</div>
        </div>
      ))}
    </div>
  );
};

/**
 * Modal (also registered as "Dialog") — opened / closed through the form's element state.
 * { "type": "Modal", "id": "m1", "props": { "title": "...", "show": false, "size": "sm" | "lg" | "xl", "centered": true,
 *   "scrollable": false, "fullscreen": false, "backdrop": true | "static", "keyboard": true, "closeButton": true },
 *   "children": [ ...body nodes... ], "footer": [ ...footer nodes... ] }
 * Open: actions.openModal("m1") or a button { "data-modal": "m1", "onClick": "openModal()" }.
 * The modal stays in the page while closed (hidden), so fields inside keep their values;
 * fields in a closed modal are not validated. onHide (schema event) runs when it closes itself.
 */
export const Modal = ({ nodeId, node, renderNodes, actions, show = false, title, size, centered, scrollable, fullscreen,
  backdrop = true, keyboard = true, closeButton = true, onHide, className = '', style }) => {
  const t = useTranslator();
  const ref = useRef(null);
  const closeRef = useRef(null);
  closeRef.current = (event) => {
    actions?.setNodeProps?.(nodeId, { show: false });
    onHide?.(event);
  };
  // Escape closes, focus stays inside while open, the page behind doesn't scroll
  useModalBehavior(show, ref, { keyboard, onEscape: (event) => closeRef.current(event) });

  return (
    <>
      <div
        ref={ref}
        className={cx('rc-modal', !show && 'rc-d-none', className)}
        style={style}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-hidden={!show || undefined}
        aria-labelledby={title ? `${nodeId}-title` : undefined}
        onMouseDown={(event) => {
          if (backdrop === true && event.target === event.currentTarget) closeRef.current(event);
        }}
      >
        <div className={modalDialogClass({ size, centered, scrollable, fullscreen })}>
          <div className="rc-modal-content">
            {(title || closeButton) && (
              <div className="rc-modal-header">
                {title && <h5 className="rc-modal-title" id={`${nodeId}-title`}>{title}</h5>}
                {closeButton && <CloseButton label={t('common.close')} onClick={(event) => closeRef.current(event)} />}
              </div>
            )}
            <div className="rc-modal-body">{renderNodes(node?.children)}</div>
            {asList(node?.footer).length > 0 && <div className="rc-modal-footer">{renderNodes(node.footer)}</div>}
          </div>
        </div>
      </div>
      {show && backdrop && <div className="rc-modal-backdrop" />}
    </>
  );
};

/**
 * Carousel — slides from items: image (src / alt), caption / text, or child nodes.
 * { "type": "Carousel", "id": "hero", "props": { "interval": 5000, "controls": true, "indicators": true, "fade": false, "pause": "hover" },
 *   "items": [ { "src": "...", "alt": "...", "caption": "...", "text": "..." }, { "children": [ ...nodes... ] } ] }
 * "interval": null stops auto-play; it pauses while the pointer is over it ("pause": false: never).
 */
export const Carousel = ({ nodeId, items = [], renderNodes, interval = 5000, controls = true, indicators = true, fade, pause = 'hover', className = '', style }) => {
  const t = useTranslator();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = items.length;
  const go = (to) => setIndex(((to % count) + count) % count);
  useEffect(() => {
    if (!interval || paused || count < 2) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), interval);
    return () => clearTimeout(timer);
  }, [index, interval, paused, count]);
  if (!count) return null;
  return (
    <div className={cx('rc-carousel', fade && 'rc-carousel-fade', className)} style={style} role="region" aria-roledescription="carousel"
      onMouseEnter={pause === 'hover' ? () => setPaused(true) : undefined} onMouseLeave={pause === 'hover' ? () => setPaused(false) : undefined}
      onKeyDown={(event) => { if (event.key === 'ArrowLeft') go(index - 1); if (event.key === 'ArrowRight') go(index + 1); }}>
      {indicators && count > 1 && (
        <div className="rc-carousel-indicators">
          {items.map((item, i) => (
            <button key={item.key ?? i} type="button" className={cx(i === index && 'rc-active')} aria-current={i === index || undefined}
              aria-label={`${i + 1} / ${count}`} onClick={() => go(i)} />
          ))}
        </div>
      )}
      <div className="rc-carousel-inner" style={fade ? undefined : { transform: `translateX(-${index * 100}%)` }}>
        {items.map((item, i) => (
          <div key={item.key ?? i} className={cx('rc-carousel-item', i === index && 'rc-active')} aria-hidden={i !== index || undefined}
            role="group" aria-roledescription="slide" id={nodeId ? `${nodeId}-slide-${i}` : undefined}>
            {item.src && <img className="rc-d-block rc-w-100" src={item.src} alt={item.alt || ''} />}
            {item.children && renderNodes(item.children)}
            {(item.caption || item.text) && (
              <div className="rc-carousel-caption">
                {item.caption && <h5>{item.caption}</h5>}
                {item.text && <p>{item.text}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
      {controls && count > 1 && (
        <>
          <button type="button" className="rc-carousel-control-prev" onClick={() => go(index - 1)}>
            <span className="rc-carousel-control-prev-icon" aria-hidden="true" />
            <span className="rc-visually-hidden">{t('carousel.previous')}</span>
          </button>
          <button type="button" className="rc-carousel-control-next" onClick={() => go(index + 1)}>
            <span className="rc-carousel-control-next-icon" aria-hidden="true" />
            <span className="rc-visually-hidden">{t('carousel.next')}</span>
          </button>
        </>
      )}
    </div>
  );
};

/**
 * Tooltip — hover / focus hint around child nodes (or a plain "label").
 * { "type": "Tooltip", "id": "tip", "props": { "text": "...", "placement": "top", "wrapperClassName": "rc-d-inline-block" },
 *   "children": [ ...nodes... ] }
 * Use "wrapperClassName": "rc-d-block" to wrap a full-width field.
 */
export const Tooltip = ({ nodeId, node, renderNodes, text, placement = 'top', label, wrapperClassName = 'rc-d-inline-block' }) => {
  const hasChildren = childrenOf(node).length > 0;
  return (
    <Overlay id={`${nodeId}-tooltip`} kind="tooltip" placement={placement} trigger="hover" wrapperClassName={wrapperClassName}
      tabIndex={hasChildren ? undefined : 0} render={() => <div className="rc-tooltip-inner">{text}</div>}>
      {hasChildren ? renderNodes(node.children) : label}
    </Overlay>
  );
};

/**
 * Popover — click (default) / hover / focus panel with a title and text, around child nodes.
 * { "type": "Popover", "id": "pop", "props": { "title": "...", "text": "...", "placement": "right",
 *   "trigger": "click" | "hover" | "focus", "wrapperClassName": "rc-d-inline-block" }, "children": [ ...nodes... ] }
 */
export const Popover = ({ nodeId, node, renderNodes, title, text, placement = 'right', trigger = 'click', label, wrapperClassName = 'rc-d-inline-block' }) => {
  const hasChildren = childrenOf(node).length > 0;
  return (
    <Overlay id={`${nodeId}-popover`} kind="popover" placement={placement} trigger={trigger} wrapperClassName={wrapperClassName}
      tabIndex={hasChildren ? undefined : 0}
      render={() => (
        <>
          {title && <h3 className="rc-popover-header">{title}</h3>}
          <div className="rc-popover-body">{text}</div>
        </>
      )}>
      {hasChildren ? renderNodes(node.children) : label}
    </Overlay>
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
    <div role="alert" className={cx('rc-alert', `rc-alert-${variant}`, dismissible && 'rc-alert-dismissible', className)} style={style}>
      {heading && <div className="rc-alert-heading">{heading}</div>}
      {text && <p className="rc-mb-0">{text}</p>}
      {renderNodes(node?.children)}
      {/* closing hides the node through element state, so actions.showNode(id) brings it back */}
      {dismissible && <CloseButton label={t('common.close')} onClick={(event) => { actions?.hideNode?.(nodeId); onClose?.(event); }} />}
    </div>
  );
};

// Components that render nested schema nodes (LayoutParser passes them renderNodes / node / items)
export const BUILT_IN_CONTAINERS = { Card, Accordion, Tabs, Modal, Dialog: Modal, Carousel, Tooltip, Popover, Alert };

// ---------------------------------------------------------------- display components (props only)

/** { "type": "Badge", "id": "b1", "props": { "text": "New", "bg": "success", "pill": true, "textColor": "dark" } } */
export const Badge = ({ text, bg = 'primary', pill, textColor, ...props }) => (
  <UiBadge bg={bg} pill={pill} text={textColor} {...props}>{text}</UiBadge>
);

/** { "type": "Breadcrumb", "id": "bc", "props": { "items": [ { "text": "Home", "href": "/" }, { "text": "Profile", "active": true } ] } } */
export const Breadcrumb = ({ items = [], label = 'breadcrumb', className, style }) => (
  <nav aria-label={label} className={className} style={style}>
    <ol className="rc-breadcrumb">
      {items.map((item, index) => (
        <li key={index} className={cx('rc-breadcrumb-item', item.active && 'rc-active')} aria-current={item.active ? 'page' : undefined}>
          {item.active || !item.href ? item.text : <a href={item.href}>{item.text}</a>}
        </li>
      ))}
    </ol>
  </nav>
);

/** { "type": "ProgressBar", "id": "p1", "props": { "now": 60, "min": 0, "max": 100, "showLabel": true, "variant": "success", "striped": true, "animated": true } } */
export const ProgressBar = ({ now = 0, min = 0, max = 100, label, showLabel, ...props }) => {
  const percent = max > min ? Math.round(((now - min) / (max - min)) * 100) : 0;
  return <UiProgressBar now={now} min={min} max={max} label={label ?? (showLabel ? `${percent}%` : undefined)} {...props} />;
};

/** { "type": "Spinner", "id": "s1", "props": { "animation": "border" | "grow", "variant": "primary", "size": "sm", "text": "Loading..." } } */
export const Spinner = ({ animation = 'border', text, ...props }) => {
  const t = useTranslator();
  return (
    <UiSpinner animation={animation} role="status" {...props}>
      <span className="rc-visually-hidden">{text || t('common.loading')}</span>
    </UiSpinner>
  );
};

/**
 * { "type": "ListGroup", "id": "lg", "props": { "flush": false, "numbered": false, "horizontal": false | true | "md",
 *   "items": [ { "text": "...", "href": "...", "active": false, "disabled": false, "variant": "info", "badge": "3", "badgeBg": "primary" } ] } }
 */
export const ListGroup = ({ items = [], flush, numbered, horizontal, className, style }) => {
  const Tag = numbered ? 'ol' : 'ul';
  return (
    <Tag style={style} className={cx('rc-list-group', flush && 'rc-list-group-flush', numbered && 'rc-list-group-numbered',
      horizontal && (horizontal === true ? 'rc-list-group-horizontal' : `rc-list-group-horizontal-${horizontal}`), className)}>
      {items.map((item, index) => {
        const classes = cx('rc-list-group-item', item.href && 'rc-list-group-item-action', item.active && 'rc-active', item.disabled && 'rc-disabled',
          item.variant && `rc-list-group-item-${item.variant}`);
        const body = (
          <>
            <span>{item.text}</span>
            {item.badge != null && <UiBadge bg={item.badgeBg || 'primary'} pill>{item.badge}</UiBadge>}
          </>
        );
        return item.href ? (
          <li key={index} className="rc-list-group-link">
            <a className={classes} href={item.disabled ? undefined : item.href} aria-disabled={item.disabled || undefined}
              aria-current={item.active || undefined}>{body}</a>
          </li>
        ) : (
          <li key={index} className={classes} aria-current={item.active || undefined}>{body}</li>
        );
      })}
    </Tag>
  );
};

export const BUILT_IN_DISPLAY = { Badge, Breadcrumb, ProgressBar, Spinner, ListGroup };
