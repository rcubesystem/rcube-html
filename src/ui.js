import {
  Children, createContext, forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState,
} from "react";
import { createPortal } from "react-dom";

/*
 * rcube-html's own building blocks: buttons, form controls, modal, dropdown, table, pager, badge, card, spinner,
 * progress bar and the overlay used by Tooltip / Popover. They take the same props the library used from
 * react-bootstrap (variant, size, isInvalid, ...) but render rc-* classes styled by rcube-html's own stylesheet
 * (styles.css), so rcube-html runs without Bootstrap — in a Bootstrap app, inside a CMS, or on a bare page.
 *
 * Colours, radius and fonts come from --rc-* CSS variables; each one falls back to Bootstrap's --bs-* variable
 * when Bootstrap is on the page, and to Bootstrap 5's own value when it isn't.
 *
 * Variants (buttons, badges, alerts, tables, list items, progress bars, spinners):
 *   primary secondary success danger warning info light dark (+ "outline-<name>" and "link" for buttons)
 */

export const cx = (...parts) => parts.flat().filter(Boolean).join(' ');

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// ---------------------------------------------------------------- buttons

/** <Button variant="outline-secondary" size="sm" active href> */
export const Button = forwardRef(function Button(
  { variant = 'primary', size, active, className, as, href, type = 'button', disabled, children, ...props }, ref,
) {
  const classes = cx('rc-btn', variant && `rc-btn-${variant}`, size && `rc-btn-${size}`, active && 'rc-active', className);
  const Tag = as || (href ? 'a' : 'button');
  if (Tag === 'a') {
    return (
      <a ref={ref} href={disabled ? undefined : href} className={cx(classes, disabled && 'rc-disabled')}
        aria-disabled={disabled || undefined} tabIndex={disabled ? -1 : undefined} {...props}>{children}</a>
    );
  }
  return <Tag ref={ref} type={Tag === 'button' ? type : undefined} className={classes} disabled={disabled} {...props}>{children}</Tag>;
});

/** <ButtonGroup size="sm" vertical> */
export const ButtonGroup = forwardRef(function ButtonGroup({ size, vertical, className, role = 'group', children, ...props }, ref) {
  return (
    <div ref={ref} role={role} className={cx(vertical ? 'rc-btn-group-vertical' : 'rc-btn-group', size && `rc-btn-group-${size}`, className)} {...props}>
      {children}
    </div>
  );
});

/** The × close button */
export const CloseButton = ({ className, label = 'Close', ...props }) => (
  <button type="button" className={cx('rc-btn-close', className)} aria-label={label} {...props} />
);

// ---------------------------------------------------------------- forms

const GroupContext = createContext({});
const CheckContext = createContext(null);

const FormRoot = forwardRef(function Form({ className, children, ...props }, ref) {
  return <form ref={ref} className={className} {...props}>{children}</form>;
});

/** <Form.Group controlId="email" as="fieldset">: gives its label and control the same id */
const Group = forwardRef(function Group({ as: Tag = 'div', controlId, className, children, ...props }, ref) {
  return (
    <GroupContext.Provider value={{ controlId }}>
      <Tag ref={ref} className={cx('rc-form-group', Tag === 'fieldset' && 'rc-fieldset', className)} {...props}>{children}</Tag>
    </GroupContext.Provider>
  );
});

const Label = forwardRef(function Label({ as: Tag = 'label', htmlFor, className, children, ...props }, ref) {
  const { controlId } = useContext(GroupContext);
  return (
    <Tag ref={ref} htmlFor={Tag === 'label' ? htmlFor ?? controlId : undefined}
      className={cx('rc-label', Tag === 'legend' && 'rc-legend', className)} {...props}>{children}</Tag>
  );
});

const Text = forwardRef(function Text({ as: Tag = 'small', className, muted, children, ...props }, ref) {
  return <Tag ref={ref} className={cx('rc-form-text', muted && 'rc-text-muted', className)} {...props}>{children}</Tag>;
});

/** <Form.Control as="textarea" size="sm" isInvalid plaintext> */
const Control = forwardRef(function Control(
  { as: Tag = 'input', type, size, isInvalid, isValid, plaintext, htmlSize, id, className, ...props }, ref,
) {
  const { controlId } = useContext(GroupContext);
  return (
    <Tag ref={ref} id={id ?? controlId} type={Tag === 'input' ? type : undefined} size={htmlSize}
      className={cx(plaintext ? 'rc-input-plaintext' : 'rc-input', size && `rc-input-${size}`, type === 'color' && 'rc-input-color',
        isInvalid && 'rc-is-invalid', isValid && 'rc-is-valid', className)}
      aria-invalid={isInvalid || undefined} {...props} />
  );
});

const Feedback = ({ type = 'valid', tooltip, className, children, ...props }) => (
  <div className={cx(type === 'invalid' ? 'rc-feedback' : 'rc-valid-feedback', className)} {...props}>{children}</div>
);
Control.Feedback = Feedback;

const Select = forwardRef(function Select({ size, htmlSize, isInvalid, isValid, id, className, children, ...props }, ref) {
  const { controlId } = useContext(GroupContext);
  return (
    <select ref={ref} id={id ?? controlId} size={htmlSize}
      className={cx('rc-select', size && `rc-select-${size}`, isInvalid && 'rc-is-invalid', isValid && 'rc-is-valid', className)}
      aria-invalid={isInvalid || undefined} {...props}>{children}</select>
  );
});

const Range = forwardRef(function Range({ id, className, ...props }, ref) {
  const { controlId } = useContext(GroupContext);
  return <input ref={ref} type="range" id={id ?? controlId} className={cx('rc-range', className)} {...props} />;
});

const CheckInput = forwardRef(function CheckInput({ type, isInvalid, isValid, id, className, ...props }, ref) {
  const check = useContext(CheckContext) || {};
  const { controlId } = useContext(GroupContext);
  const kind = type || check.type || 'checkbox';
  return (
    <input ref={ref} id={id ?? check.id ?? controlId} type={kind === 'switch' ? 'checkbox' : kind} role={kind === 'switch' ? 'switch' : undefined}
      className={cx('rc-check-input', isInvalid && 'rc-is-invalid', isValid && 'rc-is-valid', className)}
      aria-invalid={isInvalid || undefined} {...props} />
  );
});

const CheckLabel = forwardRef(function CheckLabel({ htmlFor, className, children, ...props }, ref) {
  const check = useContext(CheckContext) || {};
  const { controlId } = useContext(GroupContext);
  return <label ref={ref} htmlFor={htmlFor ?? check.id ?? controlId} className={cx('rc-check-label', className)} {...props}>{children}</label>;
});

/**
 * <Form.Check type="checkbox|radio|switch" label inline isInvalid> — or, with children, a wrapper for
 * <Form.Check.Input> / <Form.Check.Label>. The ref goes to the input when it renders one itself.
 */
const Check = forwardRef(function Check(
  { type = 'checkbox', id, inline, reverse, label, isInvalid, isValid, feedback, feedbackType, className, style, title, children, ...props }, ref,
) {
  const { controlId } = useContext(GroupContext);
  const checkId = id ?? controlId;
  const wrapper = cx('rc-check', type === 'switch' && 'rc-switch', inline && 'rc-check-inline', reverse && 'rc-check-reverse',
    !label && !children && 'rc-check-bare', className);
  return (
    <CheckContext.Provider value={{ id: checkId, type }}>
      <div className={wrapper} style={style} title={title}>
        {children ?? (
          <>
            <CheckInput ref={ref} type={type} isInvalid={isInvalid} isValid={isValid} {...props} />
            {label != null && label !== false && <CheckLabel>{label}</CheckLabel>}
            {feedback && <Feedback type={feedbackType || 'invalid'}>{feedback}</Feedback>}
          </>
        )}
      </div>
    </CheckContext.Provider>
  );
});
Check.Input = CheckInput;
Check.Label = CheckLabel;

export const Form = Object.assign(FormRoot, { Group, Label, Text, Control, Select, Range, Check });

// ---------------------------------------------------------------- display

/** <Spinner animation="border|grow" size="sm" variant="primary"> */
export const Spinner = forwardRef(function Spinner({ animation = 'border', size, variant, as: Tag = 'div', className, children, ...props }, ref) {
  return (
    <Tag ref={ref} className={cx(`rc-spinner-${animation}`, size && `rc-spinner-${animation}-${size}`, variant && `rc-text-${variant}`, className)} {...props}>
      {children}
    </Tag>
  );
});

/** <Badge bg="success" pill text="dark"> */
export const Badge = forwardRef(function Badge({ bg = 'primary', pill, text, as: Tag = 'span', className, children, ...props }, ref) {
  return (
    <Tag ref={ref} className={cx('rc-badge', bg && `rc-badge-${bg}`, pill && 'rc-rounded-pill', text && `rc-text-${text}`, className)} {...props}>
      {children}
    </Tag>
  );
});

/** <ProgressBar now min max label variant striped animated visuallyHidden> */
export const ProgressBar = ({ now = 0, min = 0, max = 100, label, variant, striped, animated, visuallyHidden, className, style, ...props }) => {
  const percent = max > min ? Math.max(0, Math.min(100, ((Number(now) - min) / (max - min)) * 100)) : 0;
  return (
    <div className={cx('rc-progress', className)} style={style} role="progressbar" aria-valuenow={now} aria-valuemin={min} aria-valuemax={max} {...props}>
      <div className={cx('rc-progress-bar', variant && `rc-bg-${variant}`, (striped || animated) && 'rc-progress-bar-striped', animated && 'rc-progress-bar-animated')}
        style={{ width: `${percent}%` }}>
        {label != null && (visuallyHidden ? <span className="rc-visually-hidden">{label}</span> : label)}
      </div>
    </div>
  );
};

const CardRoot = forwardRef(function Card({ className, border, bg, text, as: Tag = 'div', children, ...props }, ref) {
  return (
    <Tag ref={ref} className={cx('rc-card', border && `rc-border-${border}`, bg && `rc-bg-${bg}`, text && `rc-text-${text}`, className)} {...props}>
      {children}
    </Tag>
  );
});
const cardPart = (base, DefaultTag) => forwardRef(function CardPart({ as: Tag = DefaultTag, className, children, ...props }, ref) {
  return <Tag ref={ref} className={cx(base, className)} {...props}>{children}</Tag>;
});
const CardImg = ({ variant, className, alt = '', ...props }) => (
  <img className={cx(variant ? `rc-card-img-${variant}` : 'rc-card-img', className)} alt={alt} {...props} />
);
export const Card = Object.assign(CardRoot, {
  Header: cardPart('rc-card-header', 'div'), Body: cardPart('rc-card-body', 'div'), Footer: cardPart('rc-card-footer', 'div'),
  Title: cardPart('rc-card-title', 'h5'), Subtitle: cardPart('rc-card-subtitle', 'h6'), Text: cardPart('rc-card-text', 'p'), Img: CardImg,
});

/** <Table striped bordered hover size="sm" variant="dark" responsive> */
export const Table = forwardRef(function Table({ striped, bordered, borderless, hover, size, variant, responsive, className, children, ...props }, ref) {
  const table = (
    <table ref={ref} className={cx('rc-table', striped && 'rc-table-striped', bordered && 'rc-table-bordered', borderless && 'rc-table-borderless',
      hover && 'rc-table-hover', size && `rc-table-${size}`, variant && `rc-table-${variant}`, className)} {...props}>
      {children}
    </table>
  );
  if (!responsive) return table;
  return <div className={typeof responsive === 'string' ? `rc-table-responsive-${responsive}` : 'rc-table-responsive'}>{table}</div>;
});

/** <Image fluid rounded roundedCircle thumbnail> */
export const Image = forwardRef(function Image({ fluid, rounded, roundedCircle, thumbnail, className, alt = '', ...props }, ref) {
  return (
    <img ref={ref} alt={alt} className={cx(fluid && 'rc-img-fluid', rounded && 'rc-rounded', roundedCircle && 'rc-rounded-circle',
      thumbnail && 'rc-img-thumbnail', className)} {...props} />
  );
});

// ---------------------------------------------------------------- pager

const PageItem = ({ active, disabled, className, style, onClick, href, children, label, ...props }) => (
  <li className={cx('rc-page-item', active && 'rc-active', disabled && 'rc-disabled', className)} style={style}>
    {active || disabled
      ? <span className="rc-page-link" aria-current={active ? 'page' : undefined} {...props}>{children}{label && <span className="rc-visually-hidden">{label}</span>}</span>
      : <button type="button" className="rc-page-link" onClick={onClick} {...props}>{children}{label && <span className="rc-visually-hidden">{label}</span>}</button>}
  </li>
);
const pageSymbol = (symbol, label) => function PageSymbol({ children, ...props }) {
  return <PageItem {...props} label={children ? undefined : label}>{children ?? <span aria-hidden="true">{symbol}</span>}</PageItem>;
};
const PaginationRoot = ({ size, className, children, ...props }) => (
  <ul className={cx('rc-pagination', size && `rc-pagination-${size}`, className)} {...props}>{children}</ul>
);
export const Pagination = Object.assign(PaginationRoot, {
  Item: PageItem,
  First: pageSymbol('«', 'First'), Prev: pageSymbol('‹', 'Previous'), Next: pageSymbol('›', 'Next'), Last: pageSymbol('»', 'Last'),
  Ellipsis: pageSymbol('…', 'More'),
});

// ---------------------------------------------------------------- floating (dropdown menus, tooltips, popovers)

/**
 * Keep a floating element (in document.body, position: fixed) next to its anchor while open; follows scrolling
 * and resizing, flips to the other side when there isn't room. placement: top | bottom | start | end (left / right)
 */
export const useFloating = (open, anchorRef, floatRef, { placement = 'bottom', align = 'start', gap = 4 } = {}) => {
  const [pos, setPos] = useState(null);
  useIsoLayoutEffect(() => {
    if (!open) { setPos(null); return undefined; }
    let frame = 0;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect?.();
      const f = floatRef.current;
      // the floating element is drawn in <body> a moment after it opens: measure it once it's there
      if (!a || !f) { frame = requestAnimationFrame(place); return; }
      const w = f.offsetWidth; const h = f.offsetHeight;
      const vw = window.innerWidth; const vh = window.innerHeight;
      let side = { left: 'start', right: 'end' }[placement] || placement;
      if (side === 'bottom' && a.bottom + gap + h > vh && a.top - gap - h >= 0) side = 'top';
      else if (side === 'top' && a.top - gap - h < 0 && a.bottom + gap + h <= vh) side = 'bottom';
      else if (side === 'end' && a.right + gap + w > vw && a.left - gap - w >= 0) side = 'start';
      else if (side === 'start' && a.left - gap - w < 0 && a.right + gap + w <= vw) side = 'end';
      let top; let left;
      if (side === 'bottom' || side === 'top') {
        top = side === 'bottom' ? a.bottom + gap : a.top - gap - h;
        left = align === 'end' ? a.right - w : align === 'center' ? a.left + (a.width - w) / 2 : a.left;
      } else {
        left = side === 'end' ? a.right + gap : a.left - gap - w;
        top = a.top + (a.height - h) / 2;
      }
      left = Math.max(4, Math.min(left, vw - w - 4));
      top = Math.max(4, Math.min(top, vh - h - 4));
      setPos((prev) => (prev && prev.top === top && prev.left === left && prev.side === side ? prev : { top, left, side }));
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', place, true); window.removeEventListener('resize', place); };
  }, [open, placement, align, gap]);
  return pos;
};

export const Portal = ({ children }) => {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready && typeof document !== 'undefined' ? createPortal(children, document.body) : null;
};

// ---------------------------------------------------------------- dropdown

const DropdownContext = createContext(null);

/**
 * <Dropdown autoClose="outside" align="end"> <Dropdown.Toggle variant size>…</Dropdown.Toggle>
 * <Dropdown.Menu> <Dropdown.Item onClick> / <Dropdown.ItemText> / <Dropdown.Divider> / <Dropdown.Header> </Dropdown.Menu> </Dropdown>
 * autoClose: true (any click), "outside" (clicks outside the menu), "inside", false
 */
const DropdownRoot = ({ autoClose = true, align = 'start', drop = 'down', show, onToggle, className, children, ...props }) => {
  const [openState, setOpenState] = useState(false);
  const open = show ?? openState;
  const setOpen = (next) => { setOpenState(next); onToggle?.(next); };
  const toggleRef = useRef(null);
  const menuRef = useRef(null);
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      const inToggle = toggleRef.current?.contains(event.target);
      const inMenu = menuRef.current?.contains(event.target);
      if (inToggle) return;
      if (inMenu ? (autoClose === true || autoClose === 'inside') : (autoClose === true || autoClose === 'outside')) {
        if (inMenu) setTimeout(() => setOpenRef.current(false), 0); else setOpenRef.current(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { setOpenRef.current(false); toggleRef.current?.focus(); }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && menuRef.current) {
        const items = [...menuRef.current.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled)')];
        if (!items.length) return;
        event.preventDefault();
        const i = items.indexOf(document.activeElement);
        items[(i + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open, autoClose]);

  return (
    <DropdownContext.Provider value={{ open, setOpen, toggleRef, menuRef, align, drop }}>
      <div className={cx('rc-dropdown', className)} {...props}>{children}</div>
    </DropdownContext.Provider>
  );
};

const DropdownToggle = ({ variant = 'primary', size, id, className, children, ...props }) => {
  const dd = useContext(DropdownContext);
  return (
    <Button ref={dd.toggleRef} id={id} variant={variant} size={size} className={cx('rc-dropdown-toggle', className)}
      aria-haspopup="true" aria-expanded={dd.open} onClick={() => dd.setOpen(!dd.open)} {...props}>
      {children}
    </Button>
  );
};

const DropdownMenu = ({ className, style, children, ...props }) => {
  const dd = useContext(DropdownContext);
  const pos = useFloating(dd.open, dd.toggleRef, dd.menuRef, { placement: dd.drop === 'up' ? 'top' : 'bottom', align: dd.align === 'end' ? 'end' : 'start', gap: 2 });
  if (!dd.open) return null;
  return (
    <Portal>
      <div ref={dd.menuRef} role="menu" aria-labelledby={dd.toggleRef.current?.id || undefined}
        className={cx('rc-dropdown-menu', className)}
        style={{ ...style, top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }} {...props}>
        {children}
      </div>
    </Portal>
  );
};

const DropdownItem = ({ as, href, active, disabled, className, onClick, children, ...props }) => {
  const Tag = as || (href ? 'a' : 'button');
  return (
    <Tag type={Tag === 'button' ? 'button' : undefined} href={href} role="menuitem" disabled={Tag === 'button' ? disabled : undefined}
      className={cx('rc-dropdown-item', active && 'rc-active', disabled && 'rc-disabled', className)} onClick={onClick} {...props}>
      {children}
    </Tag>
  );
};

export const Dropdown = Object.assign(DropdownRoot, {
  Toggle: DropdownToggle,
  Menu: DropdownMenu,
  Item: DropdownItem,
  ItemText: ({ className, children, ...props }) => <span className={cx('rc-dropdown-item-text', className)} {...props}>{children}</span>,
  Header: ({ className, children, ...props }) => <h6 className={cx('rc-dropdown-header', className)} {...props}>{children}</h6>,
  Divider: ({ className, ...props }) => <hr className={cx('rc-dropdown-divider', className)} {...props} />,
});

// ---------------------------------------------------------------- overlay (tooltip / popover)

/**
 * An overlay shown next to its children: trigger "hover" (also focus), "focus" or "click" (closes on a click outside
 * or Escape). render(): the overlay's content; kind: "tooltip" | "popover".
 */
export const Overlay = ({ id, kind = 'tooltip', placement = 'top', trigger = 'hover', render, wrapperClassName, tabIndex, children }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const floatRef = useRef(null);
  const pos = useFloating(open, anchorRef, floatRef, { placement, align: 'center', gap: 6 });
  const triggers = Array.isArray(trigger) ? trigger : trigger === 'hover' ? ['hover', 'focus'] : [trigger];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    const onDown = (event) => {
      if (!triggers.includes('click')) return;
      if (!anchorRef.current?.contains(event.target) && !floatRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const events = {
    ...(triggers.includes('hover') && { onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false) }),
    ...(triggers.includes('focus') && { onFocus: () => setOpen(true), onBlur: () => setOpen(false) }),
    ...(triggers.includes('click') && { onClick: () => setOpen((v) => !v) }),
  };
  const side = pos?.side || ({ left: 'start', right: 'end' }[placement] || placement);
  return (
    <>
      <div ref={anchorRef} className={wrapperClassName} tabIndex={tabIndex} aria-describedby={open ? id : undefined} {...events}>{children}</div>
      {open && (
        <Portal>
          <div ref={floatRef} id={id} role={kind === 'tooltip' ? 'tooltip' : 'dialog'}
            className={cx(`rc-${kind}`, `rc-${kind}-${side}`)}
            style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}>
            {render()}
          </div>
        </Portal>
      )}
    </>
  );
};

// ---------------------------------------------------------------- modal

let openModals = 0;

/** Escape, a focus trap inside the dialog, the page behind locked, focus back where it was when it closes */
export const useModalBehavior = (show, dialogRef, { keyboard = true, onEscape } = {}) => {
  const escRef = useRef(onEscape);
  escRef.current = onEscape;
  useEffect(() => {
    if (!show) return undefined;
    const before = document.activeElement;
    openModals += 1;
    document.body.classList.add('rc-modal-open');
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])') || [])]
      .filter((el) => el.offsetParent !== null);
    if (dialog && !dialog.contains(document.activeElement)) {
      const auto = dialog.querySelector('[autofocus]');
      (auto || dialog).focus({ preventScroll: true });
    }
    const onKey = (event) => {
      if (event.key === 'Escape' && keyboard) { event.stopPropagation(); escRef.current?.(event); }
      if (event.key === 'Tab' && dialog) {
        const els = focusable();
        if (!els.length) { event.preventDefault(); return; }
        const first = els[0]; const last = els[els.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    dialog?.addEventListener('keydown', onKey);
    return () => {
      dialog?.removeEventListener('keydown', onKey);
      openModals = Math.max(0, openModals - 1);
      if (!openModals) document.body.classList.remove('rc-modal-open');
      if (before && typeof before.focus === 'function' && document.contains(before)) before.focus({ preventScroll: true });
    };
  }, [show, keyboard]);
};

export const modalDialogClass = ({ size, centered, scrollable, fullscreen, dialogClassName }) => cx(
  'rc-modal-dialog', size && `rc-modal-${size}`, centered && 'rc-modal-dialog-centered', scrollable && 'rc-modal-dialog-scrollable',
  fullscreen && 'rc-modal-fullscreen', dialogClassName,
);

const ModalContext = createContext({});

/** <Modal show onHide size="lg" centered scrollable backdrop="static" keyboard> — drawn in document.body */
const ModalRoot = ({ show, onHide, size, centered, scrollable, fullscreen, backdrop = true, keyboard = true, className, dialogClassName,
  contentClassName, 'aria-labelledby': labelledBy, children, ...props }) => {
  const ref = useRef(null);
  useModalBehavior(show, ref, { keyboard, onEscape: (event) => onHide?.(event) });
  if (!show) return null;
  return (
    <Portal>
      <ModalContext.Provider value={{ onHide }}>
        <div ref={ref} className={cx('rc-modal', className)} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy}
          onMouseDown={(event) => { if (backdrop === true && event.target === event.currentTarget) onHide?.(event); }} {...props}>
          <div className={modalDialogClass({ size, centered, scrollable, fullscreen, dialogClassName })}>
            <div className={cx('rc-modal-content', contentClassName)}>{children}</div>
          </div>
        </div>
        {backdrop && <div className="rc-modal-backdrop" />}
      </ModalContext.Provider>
    </Portal>
  );
};

const ModalHeader = ({ closeButton, closeLabel = 'Close', onHide, className, children, ...props }) => {
  const ctx = useContext(ModalContext);
  return (
    <div className={cx('rc-modal-header', className)} {...props}>
      {children}
      {closeButton && <CloseButton label={closeLabel} onClick={(event) => (onHide || ctx.onHide)?.(event)} />}
    </div>
  );
};

export const Modal = Object.assign(ModalRoot, {
  Header: ModalHeader,
  Title: cardPart('rc-modal-title', 'h5'),
  Body: cardPart('rc-modal-body', 'div'),
  Footer: cardPart('rc-modal-footer', 'div'),
});

// ---------------------------------------------------------------- grid

const BREAKPOINT_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];

/**
 * Column classes from a span: 6 -> "rc-col-6"; "auto"; { xs: 12, md: 6, lg: 4 } -> "rc-col-12 rc-col-md-6 rc-col-lg-4".
 * No span -> "rc-col" (equal widths), unless the className already sizes the column (Bootstrap's col-*, or rc-col-*).
 */
export const colClasses = (span, className = '') => {
  if (span == null || span === '') return /(^|\s)(rc-)?col(-[a-z0-9]+)*(\s|$)/.test(className) ? '' : 'rc-col';
  if (typeof span !== 'object') return span === true ? 'rc-col' : `rc-col-${span}`;
  return BREAKPOINT_NAMES.filter((bp) => span[bp] != null)
    .map((bp) => (span[bp] === true ? (bp === 'xs' ? 'rc-col' : `rc-col-${bp}`) : bp === 'xs' ? `rc-col-${span[bp]}` : `rc-col-${bp}-${span[bp]}`))
    .join(' ');
};

/** Space between a row's columns: 0-5 (rc-g-*), or { x, y } */
export const gapClasses = (gap) => {
  if (gap == null) return '';
  if (typeof gap === 'object') return cx(gap.x != null && `rc-gx-${gap.x}`, gap.y != null && `rc-gy-${gap.y}`);
  return `rc-g-${gap}`;
};

export const Container = ({ fluid, className, children, ...props }) => (
  <div className={cx(fluid ? 'rc-container-fluid' : 'rc-container', className)} {...props}>{children}</div>
);
export const Row = ({ gap, className, children, ...props }) => (
  <div className={cx('rc-row', gapClasses(gap), className)} {...props}>{children}</div>
);
export const Col = ({ span, className, children, ...props }) => (
  <div className={cx(colClasses(span, className), className) || undefined} {...props}>{children}</div>
);

export const childCount = (children) => Children.count(children);
