import { forwardRef, useEffect, useRef, useState } from "react";
import { Button, ButtonGroup, Form } from "./ui";
import { useTranslator } from "./i18n";
import { runAction } from "./form";
import { RICH_TEXT_TAGS, cleanHtml, escapeHtml, htmlToText, isHtml, richTextHtml } from "./richtextUtils";

/*
 * RichTextField — a rich text editor, a form field. Its value is cleaned HTML (simple formatting only).
 *
 * { "type": "RichTextField", "id": "details", "props": {
 *     "name": "details", "label": "Details", "required": true, "requiredMessage": "...",
 *     "hint": "Shown under the editor", "placeholder": "Write here…", "maxLength": 4000, "maxLengthMessage": "...",
 *     "minHeight": 140, "maxHeight": 480, "disabled": false, "readOnly": false, "defaultValue": "<p>Hi</p>",
 *     "toolbar": ["bold", "italic", "underline", "strike", "|", "heading", "bulletList", "numberList", "quote", "|", "link", "clear"],
 *              // a tool name, "|" (a gap), a group (an array of tools), or your own tool:
 *              //   { "key": "sign", "text": "Signature", "title": "Add my signature", "html": "<p>— Ann</p>" }   inserts HTML
 *              //   { "key": "ai", "text": "Improve", "onClick": "improveText()" }   runs a form action -> (event, context)
 *              // false: no toolbar.  Tools: bold italic underline strike heading bulletList numberList quote link unlink
 *              //   clear undo redo
 *     "source": true,                         // the "Source" button: edit the HTML itself (cleaned going back) — false hides it
 *     "headingTag": "h4",                     // what "heading" makes (h3 | h4 | h5)
 *     "allowedTags": ["p", "br", "b", ...],   // what the cleaner keeps (default: richtextUtils RICH_TEXT_TAGS)
 *     "counter": true,                        // "n / maxLength" under the editor (when maxLength is set)
 *     "onLink": "pickLink()",                 // your action gives the web address (or a Promise of it); default: a prompt
 *     "onChange": "...", "onFocus": "...", "onBlur": "..." } }
 *
 * The value sits in a hidden <textarea> (the field's ref), so getFormEntries / setFieldValue / runValidation / data work
 * like any field; "required" and "maxLength" count the text, not the markup. Older plain-text values show as text.
 * Your tool's action gets (event, { name, value, editor }) — editor: { getHtml, setHtml, insertHtml, insertText, focus }.
 *
 * RichText — shows rich text safely (cleaned again here):
 * { "type": "RichText", "id": "d1", "props": { "html": "<p>…</p>", "emptyText": "Nothing yet", "allowedTags": [...] } }
 */

const RICH_CSS = `
.rc-rich-text{overflow-wrap:anywhere}
.rc-rich-text>:last-child{margin-bottom:0}
.rc-rich-text p,.rc-rich-text div{margin:0 0 .5rem}
.rc-rich-text h3,.rc-rich-text h4,.rc-rich-text h5{font-size:1.05rem;font-weight:600;margin:.75rem 0 .4rem}
.rc-rich-text ul,.rc-rich-text ol{margin:0 0 .5rem;padding-left:1.4rem}
.rc-rich-text blockquote{border-left:3px solid var(--rc-border-color);margin:0 0 .5rem;padding:.1rem 0 .1rem .75rem;color:var(--rc-secondary-color)}
.rc-rte .rc-rte-bar .rc-btn{display:inline-flex;align-items:center;justify-content:center;min-width:32px;gap:4px}
.rc-rte .rc-rte-bar svg{display:block}
.rc-rte .rc-rte-box:focus-within{border-color:var(--rc-primary)!important;box-shadow:0 0 0 .2rem rgba(var(--rc-primary-rgb),.15)}
`;

// Small icons (16px, currentColor) so the library needs no icon package
const svg = (children, props = {}) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" {...props}>{children}</svg>
);
const glyph = (text, style) => svg(<text x="8" y="12.5" textAnchor="middle" fontSize="12" fontFamily="Georgia, serif" style={style}>{text}</text>);
const ICONS = {
  bold: glyph('B', { fontWeight: 700 }),
  italic: glyph('I', { fontStyle: 'italic' }),
  underline: glyph('U', { textDecoration: 'underline' }),
  strike: glyph('S', { textDecoration: 'line-through' }),
  heading: glyph('H', { fontWeight: 700 }),
  bulletList: svg(<><circle cx="2.5" cy="4" r="1.3" /><circle cx="2.5" cy="8" r="1.3" /><circle cx="2.5" cy="12" r="1.3" /><rect x="5.5" y="3.3" width="9" height="1.4" rx=".7" /><rect x="5.5" y="7.3" width="9" height="1.4" rx=".7" /><rect x="5.5" y="11.3" width="9" height="1.4" rx=".7" /></>),
  numberList: svg(<><text x="0.5" y="6" fontSize="5.5" fontFamily="sans-serif">1</text><text x="0.5" y="13.5" fontSize="5.5" fontFamily="sans-serif">2</text><rect x="5.5" y="3.3" width="9" height="1.4" rx=".7" /><rect x="5.5" y="7.3" width="9" height="1.4" rx=".7" /><rect x="5.5" y="11.3" width="9" height="1.4" rx=".7" /></>),
  quote: glyph('“', { fontSize: 18 }),
  link: svg(<path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M6.6 9.4a2.6 2.6 0 0 0 3.7 0l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.8.8M9.4 6.6a2.6 2.6 0 0 0-3.7 0L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8" />),
  unlink: svg(<path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" d="M10.3 9.4l2.4-2.4a2.6 2.6 0 0 0-3.7-3.7l-.8.8M5.7 6.6L3.3 9a2.6 2.6 0 0 0 3.7 3.7l.8-.8M2 2l12 12" />),
  clear: svg(<><text x="6.5" y="12.5" textAnchor="middle" fontSize="12" fontFamily="Georgia, serif">T</text><path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" d="M10 9l4 4M14 9l-4 4" /></>),
  undo: svg(<path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M5 4L2 7l3 3M2.5 7H10a4 4 0 0 1 0 8H7" />),
  redo: svg(<path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M11 4l3 3-3 3M13.5 7H6a4 4 0 0 0 0 8h3" />),
  source: svg(<path fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="M5 4L1.5 8 5 12M11 4l3.5 4L11 12M9.5 2.5l-3 11" />),
};

// The built-in tools: what each does to the editor
const BUILT_IN_TOOLS = ['bold', 'italic', 'underline', 'strike', 'heading', 'bulletList', 'numberList', 'quote', 'link', 'unlink', 'clear', 'undo', 'redo'];
export const RICH_TEXT_TOOLBAR = ['bold', 'italic', 'underline', 'strike', '|', 'heading', 'bulletList', 'numberList', 'quote', '|', 'link', 'clear'];
const COMMANDS = { bold: 'bold', italic: 'italic', underline: 'underline', strike: 'strikeThrough', bulletList: 'insertUnorderedList', numberList: 'insertOrderedList', unlink: 'unlink', undo: 'undo', redo: 'redo' };

// "toolbar" -> groups of tools: ["bold", "|", "link"] or [["bold", "italic"], ["link"]] (unknown names are skipped)
const toolGroups = (toolbar) => {
  if (!toolbar) return [];
  const groups = [[]];
  for (const item of toolbar) {
    if (item === '|') groups.push([]);
    else if (Array.isArray(item)) groups.push(item.filter((x) => x !== '|'), []);
    else groups[groups.length - 1].push(item);
  }
  return groups
    .map((group) => group.filter((tool) => (typeof tool === 'string' ? BUILT_IN_TOOLS.includes(tool) : tool && typeof tool === 'object')))
    .filter((group) => group.length);
};

/** Rich text shown safely (cleaned again here); older plain text keeps its line breaks */
export const RichText = ({ html, value, emptyText, allowedTags, className = '', style, functionMap, ...props }) => {
  const content = html ?? value;
  if (!content) return emptyText ? <div className={`rc-text-body-secondary ${className}`.trim()} style={style}>{emptyText}</div> : null;
  if (!isHtml(content)) return <div className={className} style={{ whiteSpace: 'pre-wrap', ...style }} {...props}>{content}</div>;
  return (
    <>
      <style>{RICH_CSS}</style>
      <div className={`rc-rich-text ${className}`.trim()} style={style} {...props} dangerouslySetInnerHTML={{ __html: cleanHtml(content, { allowedTags }) }} />
    </>
  );
};

export const RichTextField = forwardRef(function RichTextField({
  name, id, label, error, required, requiredMessage, maxLengthMessage, hint, placeholder, defaultValue, className = '',
  disabled = false, readOnly = false, maxLength, minHeight = 140, maxHeight = 480, counter = true,
  toolbar = RICH_TEXT_TOOLBAR, source: sourceButton = true, headingTag = 'h4', allowedTags = RICH_TEXT_TAGS,
  onChange, onFocus, onBlur, onLink, actions, style,
}, ref) {
  const t = useTranslator();
  const clean = (html) => cleanHtml(html, { allowedTags });
  const [source, setSource] = useState(null); // the HTML being edited by hand (null: the formatted view)
  // The value this editor holds now: the form sets values again as it re-renders — the same one changes nothing
  const current = useRef(null);
  const fieldId = id || name;
  const box = useRef(null);
  const store = useRef(null);
  const [length, setLength] = useState(0);
  const [empty, setEmpty] = useState(true);
  const locked = disabled || readOnly;

  const measure = (html) => { const text = htmlToText(html); setLength(text.length); setEmpty(!text.trim()); };
  const show = (value) => {
    current.current = value ?? '';
    if (!box.current) return;
    box.current.innerHTML = richTextHtml(value, { allowedTags });
    measure(box.current.innerHTML);
  };
  const tell = () => onChange?.({ type: 'change', target: store.current, currentTarget: store.current });
  // What's typed: cleaned into the hidden textarea, and the form told
  const sync = () => {
    if (!box.current) return;
    const html = clean(box.current.innerHTML);
    measure(html);
    if (store.current) store.current.value = html;
    current.current = html;
    tell();
  };
  const setStore = (el) => {
    store.current = el;
    if (typeof ref === 'function') ref(el); else if (ref) ref.current = el;
  };
  useEffect(() => {
    const el = store.current;
    if (!el) return undefined;
    // A value set in code (setFieldValue / data / defaultValue): cleaned, so the form holds what the editor shows
    const take = (value) => { const html = value ? clean(richTextHtml(value, { allowedTags })) : ''; el.value = html; show(html); };
    const onSet = () => { if (el.value === current.current) return; setSource(null); take(el.value); };
    el.addEventListener('rcube:valueset', onSet);
    take(el.value || defaultValue || '');
    return () => el.removeEventListener('rcube:valueset', onSet);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the editor; with no cursor in it, the cursor goes to the end (so inserts don't land at the start)
  const caret = () => {
    const el = box.current;
    if (!el) return;
    // where the cursor is before focusing (focusing puts it at the start)
    const sel = window.getSelection();
    const inside = Boolean(sel?.rangeCount && el.contains(sel.anchorNode));
    el.focus();
    if (sel && !inside) {
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    return inside;
  };
  // The editor handle given to your tools' actions
  const editor = {
    getHtml: () => store.current?.value || '',
    setHtml: (html) => { show(clean(html)); sync(); },
    // at the cursor; with no cursor in the editor: its own block at the end
    insertHtml: (html) => {
      if (caret()) document.execCommand('insertHTML', false, clean(html));
      else if (box.current) { box.current.insertAdjacentHTML('beforeend', clean(html)); caret(); }
      sync();
    },
    insertText: (text) => { caret(); document.execCommand('insertText', false, String(text ?? '')); sync(); },
    focus: () => box.current?.focus(),
  };

  const block = (tag) => {
    const inIt = document.queryCommandValue('formatBlock')?.toLowerCase() === tag;
    document.execCommand('formatBlock', false, inIt ? 'p' : tag);
  };
  const addLink = async (event) => {
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const asked = onLink ? await runAction(actions, onLink, event, { name, value: editor.getHtml(), selectionText: selection?.toString() || '', editor })
      : window.prompt(t('richtext.linkPrompt'), 'https://');
    const url = String(asked || '').trim();
    if (!/^(https?:\/\/|mailto:)\S+/i.test(url)) return;
    box.current?.focus();
    if (range) { selection.removeAllRanges(); selection.addRange(range); }
    if (range && !range.collapsed) document.execCommand('createLink', false, url);
    else document.execCommand('insertHTML', false, `<a href="${escapeHtml(url)}">${escapeHtml(url)}</a>`);
    sync();
  };
  const run = (tool, event) => {
    if (locked) return;
    if (typeof tool === 'object') {
      if (tool.html) editor.insertHtml(tool.html);
      if (tool.onClick) runAction(actions, tool.onClick, event, { name, value: editor.getHtml(), editor, tool: tool.key });
      return;
    }
    box.current?.focus();
    if (tool === 'link') { addLink(event); return; }
    if (tool === 'heading') block(['h3', 'h4', 'h5'].includes(headingTag) ? headingTag : 'h4');
    else if (tool === 'quote') block('blockquote');
    else if (tool === 'clear') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); document.execCommand('unlink'); }
    else document.execCommand(COMMANDS[tool]);
    sync();
  };
  // Pasted from a web page or a document: simple formatting only
  const onPaste = (e) => {
    e.preventDefault();
    if (locked) return;
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? clean(html) : escapeHtml(text).replace(/\n/g, '<br>'));
    sync();
  };
  // The HTML by hand: kept as typed while editing (the form reads it), cleaned on the way back
  const toggleSource = () => {
    if (source === null) {
      setSource(clean(box.current.innerHTML).replace(/(<\/(p|div|h[3-5]|li|ul|ol|blockquote)>)/g, '$1\n'));
      return;
    }
    show(clean(source));
    setSource(null);
    sync();
  };
  const typeSource = (text) => {
    setSource(text);
    measure(text);
    if (store.current) store.current.value = text;
    current.current = text;
    tell();
  };

  const over = maxLength && length > maxLength;
  const message = error || (over ? (maxLengthMessage || t('richtext.tooLong', { max: maxLength, count: length })) : '');
  const groups = toolGroups(toolbar);
  const titleOf = (tool) => (typeof tool === 'object' ? tool.title || tool.text || tool.key : t(`richtext.${tool}`));
  const showBar = groups.length || sourceButton;

  return (
    <Form.Group className={`rc-rte rc-mb-3 ${className}`.trim()} style={style}>
      <style>{RICH_CSS}</style>
      {label && (
        <Form.Label htmlFor={`${fieldId}-editor`} onClick={() => box.current?.focus()}>
          {label}{required && <span className="rc-text-danger rc-ms-1" aria-hidden="true">*</span>}
        </Form.Label>
      )}
      <div className={`rc-rte-box rc-border rc-rounded ${message ? 'rc-border-danger' : ''} ${locked ? 'rc-bg-body-tertiary' : ''}`.trim()}>
        {showBar && (
          <div className="rc-rte-bar rc-d-flex rc-flex-wrap rc-gap-1 rc-p-1 rc-border-bottom rc-bg-body-tertiary" role="toolbar" aria-label={t('richtext.toolbar', { label: label || '' }).trim()}>
            {groups.map((group, g) => (
              <ButtonGroup key={g} size="sm">
                {group.map((tool) => {
                  const key = typeof tool === 'object' ? tool.key || tool.text : tool;
                  const title = titleOf(tool);
                  return (
                    <Button key={key} variant={(typeof tool === 'object' && tool.variant) || 'light'} title={title} aria-label={title} data-tool={key}
                      disabled={locked || source !== null} onMouseDown={(e) => e.preventDefault()} onClick={(e) => run(tool, e)}>
                      {typeof tool === 'object' ? (tool.icon ? <span aria-hidden="true">{tool.icon}</span> : null) : ICONS[tool]}
                      {typeof tool === 'object' && tool.text ? <span className="rc-small">{tool.text}</span> : null}
                    </Button>
                  );
                })}
              </ButtonGroup>
            ))}
            {sourceButton && (
              <Button size="sm" variant={source !== null ? 'secondary' : 'light'} className="rc-ms-auto" aria-pressed={source !== null} disabled={locked}
                title={source !== null ? t('richtext.formattedTitle') : t('richtext.sourceTitle')}
                onMouseDown={(e) => e.preventDefault()} onClick={toggleSource}>
                {ICONS.source}<span className="rc-small">{source !== null ? t('richtext.formatted') : t('richtext.source')}</span>
              </Button>
            )}
          </div>
        )}
        {source !== null && (
          <Form.Control as="textarea" aria-label={t('richtext.sourceLabel', { label: label || '' }).trim()} className="rc-border-0 rc-rounded-0 rc-font-monospace rc-small"
            spellCheck={false} style={{ minHeight, maxHeight, boxShadow: 'none' }} value={source} onChange={(e) => typeSource(e.target.value)} onBlur={onBlur} />
        )}
        <div className={`rc-position-relative ${source !== null ? 'rc-d-none' : ''}`.trim()}>
          {empty && placeholder && <div className="rc-position-absolute rc-text-body-secondary rc-px-3 rc-py-2 rc-pe-none">{placeholder}</div>}
          <div id={`${fieldId}-editor`} ref={box} className="rc-rich-text rc-px-3 rc-py-2" contentEditable={!locked} suppressContentEditableWarning
            role="textbox" aria-multiline="true" aria-label={label} aria-required={required || undefined} aria-invalid={Boolean(message)} aria-readonly={locked || undefined}
            style={{ minHeight, maxHeight, overflowY: 'auto', outline: 'none' }}
            onInput={sync} onBlur={(e) => { sync(); onBlur?.(e); }} onFocus={onFocus} onPaste={onPaste} />
        </div>
      </div>
      <textarea ref={setStore} name={name} id={fieldId} required={required} hidden readOnly defaultValue="" tabIndex={-1} aria-hidden="true"
        data-rcube-richtext="" />
      {(hint || message || (maxLength && counter)) && (
        <div className="rc-d-flex rc-gap-2">
          {message ? <div className="rc-feedback rc-d-block">{message}</div> : hint ? <Form.Text className="rc-text-body-secondary">{hint}</Form.Text> : null}
          {maxLength && counter ? <Form.Text className={`rc-ms-auto ${over ? 'rc-text-danger' : 'rc-text-body-secondary'}`}>{t('richtext.counter', { count: length, max: maxLength })}</Form.Text> : null}
        </div>
      )}
    </Form.Group>
  );
});
