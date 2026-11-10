/*
 * Rich text helpers (no React): the HTML cleaner the RichTextField uses as it's typed / pasted / shown.
 *
 * Only simple formatting is kept by default — paragraphs, line breaks, bold / italic / underline / strike, headings
 * (h3–h5), lists, quotes and links (http, https, mailto; they open in a new tab). Every other tag is dropped (its
 * text kept); script / style / iframe… are dropped with their content; every attribute but a link's href is dropped.
 *   cleanHtml("<p onclick=x>Hi <script>…</script><b>there</b></p>")   -> "<p>Hi <b>there</b></p>"
 *   cleanHtml(html, { allowedTags: ["p", "br", "b", "a"] })            -> only those
 *   isHtml("plain text")  -> false        htmlToText("<p>Hi<br>there</p>")  -> "Hi\nthere"
 * Clean again on the server before saving: the browser can always be bypassed.
 */

export const RICH_TEXT_TAGS = ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h3', 'h4', 'h5', 'ul', 'ol', 'li', 'blockquote', 'a', 'div'];
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'template', 'noscript', 'textarea', 'select', 'svg', 'math', 'head', 'title']);
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

const escapeText = (s) => s.replace(/&(?!(?:[a-z]+|#\d+|#x[\da-f]+);)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const decode = (s) => s.replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Escape plain text for HTML */
export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Does the value hold HTML tags? (older plain-text values don't: show them as text) */
export const isHtml = (value) => /<\/?[a-z][a-z0-9]*[\s>/]/i.test(String(value || ''));

/** The text of some HTML (paragraphs and breaks as new lines) */
export const htmlToText = (value) => decode(String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n').replace(/<[^>]*>/g, ''))
  .replace(/\n{3,}/g, '\n\n').trim();

/** The HTML with only the allowed tags; "" for nothing but empty markup. options: { allowedTags } */
export const cleanHtml = (value, { allowedTags = RICH_TEXT_TAGS } = {}) => {
  const keep = new Set(allowedTags.map((tag) => String(tag).toLowerCase()));
  const input = String(value ?? '');
  const out = [];
  const open = [];
  let skip = null; // inside a tag dropped with its content
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*\/?>/g;
  let last = 0;
  let m;
  while ((m = re.exec(input))) {
    if (!skip && m.index > last) out.push(escapeText(input.slice(last, m.index)));
    last = re.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    const tag = m[1].toLowerCase();
    const closing = m[0][1] === '/';
    if (skip) { if (closing && tag === skip) skip = null; continue; }
    if (DROP_WITH_CONTENT.has(tag)) { if (!closing && !m[0].endsWith('/>')) skip = tag; continue; }
    if (!keep.has(tag)) continue;
    const name = tag === 'strike' ? 's' : tag;
    if (closing) {
      const at = open.lastIndexOf(name);
      if (at < 0) continue;
      while (open.length > at) out.push(`</${open.pop()}>`);
      continue;
    }
    if (name === 'br') { out.push('<br>'); continue; }
    if (name === 'a') {
      const href = (m[2].match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i) || []).slice(1).find((x) => x !== undefined);
      const url = href ? decode(href).trim() : '';
      if (!SAFE_URL.test(url)) { out.push('<a>'); open.push('a'); continue; }
      out.push(`<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">`);
    } else out.push(`<${name}>`);
    open.push(name);
  }
  if (!skip && last < input.length) out.push(escapeText(input.slice(last)));
  while (open.length) out.push(`</${open.pop()}>`);
  const html = out.join('').trim();
  return htmlToText(html).trim() ? html : '';
};

/** What an editor / display shows for a value: cleaned HTML, or plain text with its line breaks */
export const richTextHtml = (value, options) => (isHtml(value) ? cleanHtml(value, options) : escapeHtml(value).replace(/\n/g, '<br>'));
