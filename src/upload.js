import { forwardRef, useEffect, useRef, useState } from "react";
import { Button, Form, Modal, ProgressBar } from "react-bootstrap";
import { useTranslator } from "./i18n";

/*
 * FileUploadField (also "FileUpload") — drag & drop / browse / paste file upload, a form field.
 *
 * { "type": "FileUploadField", "id": "docs", "props": {
 *     "name": "documents", "label": "Documents", "required": true,
 *     "multiple": true, "accept": ".pdf,image/*", "maxFiles": 5, "minFiles": 1, "maxSize": "5MB", "minSize": 1,
 *     "maxTotalSize": "20MB", "allowDuplicates": false,
 *     "autoUpload": true, "parallel": 3, "retries": 1,
 *     "onUpload": "uploadFile()",            // your action uploads; or built in: "uploadUrl": "/api/upload" (+ uploadMethod,
 *                                           //   uploadFieldName, uploadHeaders, uploadData, withCredentials)
 *     "variant": "list", "compact": false, "dropAnywhere": false, "paste": true, "directory": false, "capture": "environment",
 *     "title": "Drag & drop files here", "hint": "PDF or images", "buttonText": "Browse",
 *     "fileTitle": true, "fileTitleMax": 50, "fileTitleLabel": "File title", "fileTitlePlaceholder": "...",
 *     "defaultFiles": [ { "name": "contract.pdf", "size": 120000, "url": "/files/contract.pdf" } ],
 *     "onFilesAdded": "...", "onFileRejected": "...", "onUploadComplete": "...", "onUploadError": "...",
 *     "onAllComplete": "...", "onRemove": "...", "onFileClick": "...", "onValidate": "...", "onChange": "..." } }
 *
 * File title (fileTitle, shown unless false): an optional title (at most fileTitleMax, 50) typed before adding files;
 * the files added next get it (then the box clears). onUpload gets it as `title`, the built-in uploader sends it as
 * the form field "title", and each file in the value has it. The list shows "title" over the file name.
 *
 * The field's value (getFormEntries, getFieldValue, onChange context) is the list of files:
 *   [{ id, name, size, type, status, progress, title?, url?, response?, file? }]
 * setFieldValue(name, [{ name, size, url }]) shows files that are already uploaded; "" clears the field.
 * From code: actions.uploadFiles(name), clearFiles(name), removeFile(name, fileId), retryFile(name, fileId),
 * openFilePicker(name), getFiles(name).
 */

const UPLOAD_CSS = `
.rc-upload .rc-drop{border:2px dashed var(--bs-border-color);border-radius:12px;padding:28px 16px;text-align:center;cursor:pointer;
  background:var(--bs-tertiary-bg);transition:border-color .15s,background-color .15s,transform .15s;outline:none}
.rc-upload .rc-drop.rc-compact{padding:10px 14px;display:flex;align-items:center;gap:10px;text-align:left}
.rc-upload .rc-drop:hover,.rc-upload .rc-drop:focus-visible{border-color:var(--bs-primary);background:rgba(var(--bs-primary-rgb),.04)}
.rc-upload .rc-drop:focus-visible{box-shadow:0 0 0 .25rem rgba(var(--bs-primary-rgb),.25)}
.rc-upload .rc-drop.rc-over{border-color:var(--bs-primary);background:rgba(var(--bs-primary-rgb),.1);transform:scale(1.01)}
.rc-upload .rc-drop.rc-invalid{border-color:var(--bs-danger)}
.rc-upload .rc-drop.rc-disabled{opacity:.6;cursor:not-allowed}
.rc-upload .rc-drop-icon{color:var(--bs-primary)}
.rc-upload .rc-files{list-style:none;padding:0;margin:8px 0 0}
.rc-upload .rc-file{display:flex;gap:12px;align-items:center;padding:8px 10px;border:1px solid var(--bs-border-color);border-radius:8px;margin-top:8px;background:var(--bs-body-bg)}
.rc-upload .rc-file.rc-bad{border-color:var(--bs-danger-border-subtle);background:var(--bs-danger-bg-subtle)}
.rc-upload .rc-thumb{width:44px;height:44px;border-radius:6px;object-fit:cover;flex:none;display:flex;align-items:center;justify-content:center;
  font-size:.65rem;font-weight:700;color:#fff;letter-spacing:.02em;border:0;padding:0;overflow:hidden}
.rc-upload button.rc-thumb{cursor:zoom-in}
.rc-upload .rc-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:10px;list-style:none;padding:0}
.rc-upload .rc-card{border:1px solid var(--bs-border-color);border-radius:8px;overflow:hidden;position:relative;background:var(--bs-body-bg)}
.rc-upload .rc-card.rc-bad{border-color:var(--bs-danger)}
.rc-upload .rc-card .rc-thumb{width:100%;height:110px;border-radius:0;font-size:1rem}
.rc-upload .rc-card-actions{position:absolute;top:4px;right:4px;display:flex;gap:4px}
.rc-upload .rc-icon-btn{border:0;border-radius:6px;min-width:28px;height:28px;padding:0 6px;font-size:.8rem;background:var(--bs-secondary-bg);color:var(--bs-body-color)}
.rc-upload .rc-icon-btn:hover{background:var(--bs-tertiary-bg);filter:brightness(.95)}
.rc-upload .rc-icon-btn:disabled{opacity:.5}
.rc-upload .rc-progress{height:4px}
.rc-upload-overlay{position:fixed;inset:0;z-index:2000;background:rgba(var(--bs-primary-rgb),.12);border:3px dashed var(--bs-primary);
  display:flex;align-items:center;justify-content:center;pointer-events:none;font-size:1.5rem;font-weight:600;color:var(--bs-primary)}
`;

// ---------------------------------------------------------------- helpers

// 5000000, "5MB", "500 KB", "1.5gb" -> bytes
export const parseSize = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') return value;
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i.exec(String(value));
  if (!m) return null;
  const unit = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] || 'b').toLowerCase()];
  return Math.round(Number(m[1]) * unit);
};

export const formatBytes = (bytes, locale) => {
  if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Number(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${units[i]}`;
};

// accept: ".pdf,.docx,image/*,application/zip"
const acceptMatches = (file, accept) => String(accept).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).some((rule) => {
  const name = String(file.name || '').toLowerCase();
  const type = String(file.type || '').toLowerCase();
  if (rule.startsWith('.')) return name.endsWith(rule);
  if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
  return type === rule;
});
// ".pdf,image/*,image/png" -> "PDF, Images, PNG"
const GROUP_LABELS = { image: 'Images', video: 'Videos', audio: 'Audio', text: 'Text' };
const acceptLabel = (accept) => String(accept).split(',').map((s) => s.trim()).filter(Boolean)
  .map((s) => {
    if (s.endsWith('/*')) return GROUP_LABELS[s.slice(0, -2)] || s.slice(0, -2).toUpperCase();
    if (s.includes('/')) return s.split('/')[1].replace(/^x-/, '').toUpperCase();
    return s.replace(/^\./, '').toUpperCase();
  }).join(', ');

const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(String(name || ''))?.[1] || 'file').toUpperCase();
const isImage = (entry) => /^image\//.test(entry.type || '') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(entry.name || '');
// Badge color for a file kind
export const fileKindColor = (entry) => {
  const ext = extOf(entry.name).toLowerCase();
  if (isImage(entry)) return '#6250d6';
  if (ext === 'pdf') return '#d03b3b';
  if (['doc', 'docx', 'txt', 'rtf', 'odt', 'md'].includes(ext)) return '#2a78d6';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return '#008300';
  if (['ppt', 'pptx', 'key', 'odp'].includes(ext)) return '#eb6834';
  if (['zip', 'rar', '7z', 'gz', 'tar'].includes(ext)) return '#8a6d00';
  if (/^(audio|video)\//.test(entry.type || '')) return '#e87ba4';
  return '#6c757d';
};

let uploadCounter = 0;
const newFileId = () => `f${Date.now().toString(36)}${(uploadCounter += 1)}`;

/**
 * Upload one file with XMLHttpRequest (reports upload progress, unlike fetch).
 * Resolves with the parsed JSON (or text) response; rejects on HTTP errors, network errors and abort.
 * Handy inside an onUpload action:  uploadWithXhr({ url: "/api/files", file, onProgress, signal })
 */
export const uploadWithXhr = ({ url, file, fileName, method = 'POST', fieldName = 'file', headers = {}, data = {}, withCredentials = false, onProgress, signal }) => (
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.withCredentials = Boolean(withCredentials);
    Object.entries(headers || {}).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.((e.loaded / e.total) * 100); };
    xhr.onload = () => {
      let body = xhr.responseText;
      try { body = JSON.parse(body); } catch { /* plain text response */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body);
      else reject(new Error((body && typeof body === 'object' && body.message) || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(Object.assign(new Error('Upload cancelled'), { name: 'AbortError' }));
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    Object.entries(data || {}).forEach(([key, value]) => form.append(key, value));
    form.append(fieldName, file, fileName || file.name);
    xhr.send(form);
  })
);

const UploadIcon = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 8.5a4 4 0 0 1-.5 9.5" />
    <path d="M12 12v9" /><path d="m8.5 15.5 3.5-3.5 3.5 3.5" />
  </svg>
);

// ---------------------------------------------------------------- component

export const FileUploadField = forwardRef(function FileUploadField({
  name, id, label, error, onChange, required, disabled = false,
  multiple = true, accept, maxFiles, minFiles, maxSize, minSize, maxTotalSize, allowDuplicates = false,
  uploadUrl, uploadMethod = 'POST', uploadFieldName = 'file', uploadHeaders, uploadData, withCredentials,
  autoUpload = true, parallel = 3, retries = 0,
  variant = 'list', compact = false, showThumbnails = true, preview = true,
  dropAnywhere = false, paste = true, directory = false, capture,
  title, hint, buttonText, defaultFiles, locale,
  fileTitle = true, fileTitleMax = 50, fileTitleLabel, fileTitlePlaceholder,
  className = '', style,
  onUpload, onFilesAdded, onFileRejected, onUploadComplete, onUploadError, onAllComplete, onRemove, onFileClick, onValidate,
}, ref) {
  const t = useTranslator();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const fromExisting = (f) => ({
    id: String(f.id ?? newFileId()), name: f.name || 'file', size: f.size ?? null, type: f.type || '',
    status: 'done', progress: 100, url: f.url, response: f.response, existing: true, ...(f.title && { title: String(f.title) }),
  });
  const [files, setFiles] = useState(() => (defaultFiles || []).map(fromExisting));
  const filesRef = useRef(files);
  filesRef.current = files;
  const [over, setOver] = useState(false);
  const [overPage, setOverPage] = useState(false);
  const [previewing, setPreviewing] = useState(null);
  const [announce, setAnnounce] = useState('');
  // The title for the next files added (fileTitle)
  const [nextTitle, setNextTitle] = useState('');
  const nextTitleRef = useRef('');
  nextTitleRef.current = nextTitle;
  const titleMax = Math.max(1, Number(fileTitleMax) || 50);
  const controllers = useRef(new Map()); // id -> AbortController
  const started = useRef(new Set()); // ids whose upload is running

  const canUpload = Boolean(onUpload || uploadUrl);
  const maxBytes = parseSize(maxSize);
  const minBytes = parseSize(minSize);
  const maxTotal = parseSize(maxTotalSize);
  const fieldId = id || name;

  const update = (fileId, patch) => setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f)));
  const publicOf = (f) => ({
    id: f.id, name: f.name, size: f.size, type: f.type, status: f.status, progress: f.progress,
    ...(f.title && { title: f.title }), ...(f.url && { url: f.url }), ...(f.response !== undefined && { response: f.response }), ...(f.error && { error: f.error }),
    ...(f.file && { file: f.file }),
  });
  // The field's value: files that count (not rejected, not failed)
  const valueOf = (list) => list.filter((f) => f.status !== 'rejected' && f.status !== 'error').map(publicOf);

  const revoke = (f) => { if (f.thumb) URL.revokeObjectURL(f.thumb); };
  useEffect(() => () => {
    filesRef.current.forEach(revoke);
    controllers.current.forEach((c) => c.abort());
  }, []);

  // ---------------------------------------------------------------- adding
  const makeEntry = (file, fileTitleText = '') => ({
    id: newFileId(), file, name: file.name || 'pasted-file', size: file.size, type: file.type || '',
    status: 'queued', progress: 0, attempts: 0, ...(fileTitleText && { title: fileTitleText }),
    thumb: showThumbnails && /^image\//.test(file.type || '') && typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : null,
  });

  const problemWith = (file, kept, total) => {
    if (accept && !acceptMatches(file, accept)) return ['type', t('upload.badType', { types: acceptLabel(accept) })];
    if (maxBytes && file.size > maxBytes) return ['size', t('upload.tooBig', { max: formatBytes(maxBytes, locale) })];
    if (minBytes && file.size < minBytes) return ['minSize', t('upload.tooSmall', { min: formatBytes(minBytes, locale) })];
    if (!allowDuplicates && kept.some((f) => f.name === file.name && f.size === file.size)) return ['duplicate', t('upload.duplicate')];
    if (multiple && maxFiles && kept.length >= maxFiles) return ['count', t('upload.tooMany', { max: maxFiles })];
    if (maxTotal && total + file.size > maxTotal) return ['total', t('upload.totalTooBig', { max: formatBytes(maxTotal, locale) })];
    const custom = onValidate?.({ field: name, file, name: file.name, size: file.size, type: file.type });
    if (typeof custom === 'string' && custom) return ['custom', custom];
    return null;
  };

  const addFiles = (list, source = 'browse') => {
    if (disabled) return;
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const previous = filesRef.current;
    const kept = multiple ? previous.filter((f) => f.status !== 'rejected' && f.status !== 'error') : [];
    let total = kept.reduce((sum, f) => sum + (f.size || 0), 0);
    const accepted = [];
    const rejected = [];
    // the title typed before adding goes with these files
    const given = fileTitle ? String(nextTitleRef.current || '').trim().slice(0, titleMax) : '';
    incoming.forEach((file) => {
      const problem = !multiple && accepted.length ? ['count', t('upload.onlyOne')] : problemWith(file, [...kept, ...accepted], total);
      const entry = makeEntry(file, given);
      if (problem) {
        revoke(entry);
        rejected.push({ ...entry, thumb: null, status: 'rejected', reason: problem[0], error: problem[1] });
      } else {
        accepted.push(entry);
        total += file.size;
      }
    });
    if (!multiple && accepted.length) {
      // One file: the new one replaces whatever was there
      previous.forEach((f) => { controllers.current.get(f.id)?.abort(); revoke(f); });
      setFiles([...accepted, ...rejected]);
    } else {
      setFiles((prev) => [...prev.filter((f) => f.status !== 'rejected'), ...accepted, ...rejected]);
    }
    if (accepted.length && given) setNextTitle('');
    if (accepted.length) onFilesAdded?.({ field: name, files: accepted.map(publicOf), source });
    rejected.forEach((r) => onFileRejected?.({ field: name, file: publicOf(r), reason: r.reason, message: r.error }));
    setAnnounce([
      accepted.length && t('upload.added', { count: accepted.length }),
      rejected.length && t('upload.rejected', { count: rejected.length }),
    ].filter(Boolean).join(' '));
  };

  // ---------------------------------------------------------------- uploading
  const startUpload = (entry) => {
    if (started.current.has(entry.id) || !entry.file) return;
    started.current.add(entry.id);
    const controller = new AbortController();
    controllers.current.set(entry.id, controller);
    update(entry.id, { status: 'uploading', progress: 0, error: null });
    let last = -1;
    const onProgress = (percent) => {
      const value = Math.max(0, Math.min(99, Math.round(Number(percent) || 0)));
      if (value !== last) { last = value; update(entry.id, { progress: value }); }
    };
    const payload = {
      field: name, id: entry.id, file: entry.file, name: entry.name, size: entry.size, type: entry.type, title: entry.title || '',
      attempt: entry.attempts + 1, onProgress, signal: controller.signal,
    };
    const run = onUpload
      ? Promise.resolve().then(() => onUpload(payload))
      : uploadWithXhr({
        url: uploadUrl, method: uploadMethod, fieldName: uploadFieldName, headers: uploadHeaders, data: { ...(uploadData || {}), ...(entry.title && { title: entry.title }) },
        withCredentials, file: entry.file, fileName: entry.name, onProgress, signal: controller.signal,
      });
    run.then((response) => {
      controllers.current.delete(entry.id);
      if (controller.signal.aborted) throw Object.assign(new Error('Upload cancelled'), { name: 'AbortError' });
      const url = response && typeof response === 'object' ? (response.url ?? response.location) : undefined;
      const done = { status: 'done', progress: 100, response, ...(url && { url: String(url) }) };
      update(entry.id, done);
      onUploadComplete?.({ field: name, file: publicOf({ ...entry, ...done }), response });
    }).catch((err) => {
      controllers.current.delete(entry.id);
      started.current.delete(entry.id);
      if (!filesRef.current.some((f) => f.id === entry.id)) return; // removed meanwhile
      const cancelled = controller.signal.aborted || err?.name === 'AbortError';
      if (!cancelled && entry.attempts < retries) {
        update(entry.id, { status: 'queued', requested: true, attempts: entry.attempts + 1, progress: 0 });
        return;
      }
      const message = cancelled ? t('upload.cancelled') : (err?.message || t('upload.failed'));
      update(entry.id, { status: 'error', error: message, progress: 0 });
      if (!cancelled) onUploadError?.({ field: name, file: publicOf({ ...entry, status: 'error', error: message }), error: err });
    });
  };

  // Start queued uploads, at most `parallel` at a time
  useEffect(() => {
    if (!canUpload || disabled) return;
    const busy = files.filter((f) => f.status === 'uploading').length;
    const waiting = files.filter((f) => f.status === 'queued' && (autoUpload || f.requested) && !started.current.has(f.id));
    waiting.slice(0, Math.max(0, parallel - busy)).forEach((f) => startUpload(f));
  });

  // onAllComplete once a batch of uploads has settled
  const batch = useRef(false);
  const active = files.some((f) => f.status === 'uploading' || (f.status === 'queued' && canUpload && (autoUpload || f.requested)));
  useEffect(() => {
    if (active) { batch.current = true; return; }
    if (!batch.current) return;
    batch.current = false;
    onAllComplete?.({ field: name, files: valueOf(files), failed: files.filter((f) => f.status === 'error').map(publicOf) });
    setAnnounce(t('upload.allDone'));
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Form onChange (validation clearing, the schema's onChange) whenever the files / their status change
  // (compares with the last reported list, so React's double-run of effects in dev doesn't report the initial files)
  const valueKey = files.map((f) => `${f.id}:${f.status}`).join('|');
  const reportedKey = useRef(valueKey);
  useEffect(() => {
    if (reportedKey.current === valueKey) return;
    reportedKey.current = valueKey;
    onChange?.({ type: 'change', target: rootRef.current, currentTarget: rootRef.current });
  }, [valueKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- file actions
  const uploadAll = () => setFiles((prev) => prev.map((f) => (f.status === 'queued' ? { ...f, requested: true } : f)));
  const cancel = (f) => controllers.current.get(f.id)?.abort();
  const retry = (f) => {
    started.current.delete(f.id);
    update(f.id, { status: 'queued', requested: true, error: null, progress: 0, attempts: 0 });
  };
  const remove = async (f) => {
    if (f.status === 'rejected') { setFiles((prev) => prev.filter((x) => x.id !== f.id)); return; }
    if (onRemove) {
      update(f.id, { removing: true });
      try {
        // Return false (or reject) to keep the file, e.g. when deleting it on the server failed
        const result = await onRemove({ field: name, file: publicOf(f) });
        if (result === false) { update(f.id, { removing: false }); return; }
      } catch (err) {
        update(f.id, { removing: false, error: err?.message || t('upload.removeFailed') });
        return;
      }
    }
    controllers.current.get(f.id)?.abort();
    started.current.delete(f.id);
    revoke(f);
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
    setAnnounce(t('upload.removed', { name: f.name }));
  };
  const clearAll = () => {
    filesRef.current.forEach((f) => { controllers.current.get(f.id)?.abort(); revoke(f); });
    started.current.clear();
    setFiles([]);
  };
  const openPicker = () => { if (!disabled) inputRef.current?.click(); };

  // ---------------------------------------------------------------- DOM value + API (the form reads / sets the field through its ref)
  const api = { upload: uploadAll, clear: clearAll, open: openPicker, add: addFiles, files: () => valueOf(filesRef.current),
    remove: (fileId) => { const f = filesRef.current.find((x) => x.id === String(fileId)); if (f) remove(f); },
    retry: (fileId) => { const f = filesRef.current.find((x) => x.id === String(fileId)); if (f) retry(f); } };
  const apiRef = useRef(api);
  apiRef.current = api;
  const setRef = (el) => {
    rootRef.current = el;
    if (el && !Object.getOwnPropertyDescriptor(el, 'value')) {
      Object.defineProperty(el, 'value', {
        configurable: true,
        get: () => valueOf(filesRef.current),
        // setFieldValue(name, [{ name, size, url }]) -> already-uploaded files; "" / null -> empty
        set: (next) => {
          filesRef.current.forEach((f) => { controllers.current.get(f.id)?.abort(); revoke(f); });
          started.current.clear();
          const list = Array.isArray(next) ? next.map(fromExisting) : [];
          filesRef.current = list;
          setFiles(list);
        },
      });
      Object.defineProperty(el, 'rcubeUpload', { configurable: true, get: () => apiRef.current });
    }
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  // ---------------------------------------------------------------- drop anywhere on the page
  useEffect(() => {
    if (!dropAnywhere || disabled || typeof window === 'undefined') return undefined;
    let depth = 0;
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files');
    const enter = (e) => { if (!hasFiles(e)) return; depth += 1; setOverPage(true); };
    const leave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOverPage(false); };
    const overFn = (e) => { if (hasFiles(e)) e.preventDefault(); };
    const drop = (e) => {
      depth = 0;
      setOverPage(false);
      if (!hasFiles(e) || e.defaultPrevented) return; // the drop zone itself already took it
      e.preventDefault();
      apiRef.current.add(e.dataTransfer.files, 'page');
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragleave', leave);
    window.addEventListener('dragover', overFn);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('dragover', overFn);
      window.removeEventListener('drop', drop);
    };
  }, [dropAnywhere, disabled]);

  // ---------------------------------------------------------------- render
  const visible = files;
  const counted = files.filter((f) => f.status !== 'rejected' && f.status !== 'error');
  const totalSize = counted.reduce((sum, f) => sum + (f.size || 0), 0);
  const uploading = files.filter((f) => f.status === 'uploading');
  const queued = files.filter((f) => f.status === 'queued' && !(autoUpload || f.requested));
  const failed = files.filter((f) => f.status === 'error');
  const overall = (() => {
    const list = files.filter((f) => ['uploading', 'done', 'queued'].includes(f.status) && !f.existing && f.size);
    const size = list.reduce((s, f) => s + f.size, 0);
    return size ? Math.round(list.reduce((s, f) => s + (f.size * (f.status === 'done' ? 100 : f.progress || 0)) / 100, 0) / size * 100) : 0;
  })();

  const hintText = hint ?? [
    accept && t('upload.hintTypes', { types: acceptLabel(accept) }),
    maxBytes && t('upload.hintSize', { size: formatBytes(maxBytes, locale) }),
    multiple && maxFiles && t('upload.hintCount', { count: maxFiles }),
  ].filter(Boolean).join(' · ');

  const statusText = (f) => {
    if (f.removing) return t('upload.removing');
    switch (f.status) {
      case 'uploading': return t('upload.uploading', { percent: f.progress });
      case 'done': return canUpload || f.existing ? t('upload.done') : t('upload.ready');
      case 'queued': return canUpload ? (autoUpload || f.requested ? t('upload.waiting') : t('upload.notUploaded')) : t('upload.ready');
      default: return f.error || t('upload.failed');
    }
  };
  const statusColor = (f) => (f.status === 'error' || f.status === 'rejected' ? 'var(--bs-danger-text-emphasis)'
    : f.status === 'done' ? 'var(--bs-success-text-emphasis)' : 'var(--bs-secondary-color)');

  const openPreview = (f) => {
    onFileClick?.({ field: name, file: publicOf(f) });
    if (!preview) return;
    if (isImage(f) && (f.thumb || f.url)) setPreviewing(f);
    else if (f.url && typeof window !== 'undefined') window.open(f.url, '_blank', 'noopener');
  };

  const thumbOf = (f) => {
    const src = f.thumb || (isImage(f) && f.url) || null;
    const clickable = preview && (src || f.url);
    const inner = src
      ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : extOf(f.name);
    const look = { background: src ? 'var(--bs-secondary-bg)' : fileKindColor(f) };
    return clickable
      ? <button type="button" className="rc-thumb" style={look} onClick={() => openPreview(f)} aria-label={t('upload.preview', { name: f.name })}>{inner}</button>
      : <span className="rc-thumb" style={look} aria-hidden="true">{inner}</span>;
  };

  const actionsOf = (f) => (
    <>
      {f.status === 'uploading' && (
        <button type="button" className="rc-icon-btn" onClick={() => cancel(f)} aria-label={`${t('upload.cancel')} ${f.name}`} title={t('upload.cancel')}>■</button>
      )}
      {f.status === 'error' && canUpload && f.file && (
        <button type="button" className="rc-icon-btn" onClick={() => retry(f)} aria-label={`${t('upload.retry')} ${f.name}`} title={t('upload.retry')}>↻</button>
      )}
      {f.status !== 'uploading' && (
        <button type="button" className="rc-icon-btn" onClick={() => remove(f)} disabled={f.removing || disabled}
          aria-label={`${f.status === 'rejected' ? t('upload.dismiss') : t('upload.remove')} ${f.name}`} title={f.status === 'rejected' ? t('upload.dismiss') : t('upload.remove')}>✕</button>
      )}
    </>
  );

  const bad = (f) => f.status === 'error' || f.status === 'rejected';
  const listView = visible.length > 0 && (variant === 'grid' ? (
    <ul className="rc-grid">
      {visible.map((f) => (
        <li key={f.id} className={`rc-card ${bad(f) ? 'rc-bad' : ''}`}>
          {thumbOf(f)}
          <div className="rc-card-actions">{actionsOf(f)}</div>
          <div className="p-2">
            {f.title && <div className="small fw-semibold text-truncate" title={f.title}>{f.title}</div>}
            <div className={`small text-truncate ${f.title ? 'text-muted' : 'fw-semibold'}`} title={f.name}>{f.name}</div>
            <div className="small" style={{ color: statusColor(f) }}>{statusText(f)}{f.size != null && !bad(f) && <span className="text-muted">{` · ${formatBytes(f.size, locale)}`}</span>}</div>
            {f.status === 'uploading' && <ProgressBar now={f.progress} className="rc-progress mt-1" aria-label={f.name} />}
          </div>
        </li>
      ))}
    </ul>
  ) : (
    <ul className="rc-files">
      {visible.map((f) => (
        <li key={f.id} className={`rc-file ${bad(f) ? 'rc-bad' : ''}`}>
          {thumbOf(f)}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            {f.title && <div className="small fw-semibold text-truncate" title={f.title}>{f.title}</div>}
            <div className="d-flex gap-2 align-items-baseline">
              {f.url && f.status === 'done'
                ? <a href={f.url} target="_blank" rel="noopener noreferrer" className={`small text-truncate ${f.title ? '' : 'fw-semibold'}`} title={f.name}>{f.name}</a>
                : <span className={`small text-truncate ${f.title ? 'text-muted' : 'fw-semibold'}`} title={f.name}>{f.name}</span>}
              <span className="small text-muted ms-auto text-nowrap" style={{ flex: "none" }}>{formatBytes(f.size, locale)}</span>
            </div>
            {f.status === 'uploading' && <ProgressBar now={f.progress} className="rc-progress my-1" aria-label={f.name} />}
            <div className="small" style={{ color: statusColor(f) }}>{statusText(f)}</div>
          </div>
          <div className="d-flex gap-1" style={{ flex: "none" }}>{actionsOf(f)}</div>
        </li>
      ))}
    </ul>
  ));

  const dropProps = disabled ? {} : {
    onClick: (e) => { if (!e.target.closest('button, a, input')) openPicker(); },
    onKeyDown: (e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPicker(); } },
    onDragEnter: (e) => { e.preventDefault(); setOver(true); },
    onDragOver: (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setOver(true); },
    onDragLeave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOver(false); },
    onDrop: (e) => { e.preventDefault(); setOver(false); setOverPage(false); addFiles(e.dataTransfer.files, 'drop'); },
    ...(paste && { onPaste: (e) => { if (e.clipboardData?.files?.length) { e.preventDefault(); addFiles(e.clipboardData.files, 'paste'); } } }),
  };

  return (
    <Form.Group className={`rc-upload mb-3 ${className}`.trim()} style={style}>
      <style>{UPLOAD_CSS}</style>
      {label && <Form.Label htmlFor={`${fieldId}-input`}>{label}{required && <span className="text-danger"> *</span>}</Form.Label>}
      {fileTitle && (
        <div className="mb-2" style={{ maxWidth: 420 }}>
          <Form.Label htmlFor={`${fieldId}-title`} className="small mb-1">{fileTitleLabel || t('upload.fileTitle')}</Form.Label>
          <Form.Control id={`${fieldId}-title`} size="sm" value={nextTitle} maxLength={titleMax} disabled={disabled}
            placeholder={fileTitlePlaceholder || t('upload.fileTitlePlaceholder')} aria-describedby={`${fieldId}-title-hint`}
            onChange={(e) => setNextTitle(e.target.value.slice(0, titleMax))} />
          <div id={`${fieldId}-title-hint`} className="small text-muted">{t('upload.fileTitleHint', { max: titleMax })}</div>
        </div>
      )}
      <div ref={setRef} id={fieldId} data-rcube-upload="" data-uploading={active || undefined} data-pending={(canUpload && queued.length > 0) || undefined}
        data-failed={failed.length > 0 || undefined}
        role="button" tabIndex={disabled ? -1 : 0} aria-disabled={disabled || undefined}
        aria-describedby={`${fieldId}-hint`} aria-invalid={Boolean(error) || undefined}
        className={['rc-drop', compact && 'rc-compact', over && 'rc-over', error && 'rc-invalid', disabled && 'rc-disabled'].filter(Boolean).join(' ')}
        {...dropProps}>
        <input ref={inputRef} id={`${fieldId}-input`} type="file" hidden multiple={multiple} accept={accept} capture={capture} disabled={disabled}
          {...(directory && { webkitdirectory: '', directory: '' })}
          onChange={(e) => { addFiles(e.target.files, 'browse'); e.target.value = ''; }} />
        {compact ? (
          <>
            <span className="rc-drop-icon"><UploadIcon size={24} /></span>
            <span className="flex-grow-1">
              <span>{over ? t('upload.dropNow') : (title || t('upload.dropHere'))}</span>
              {hintText && <span id={`${fieldId}-hint`} className="d-block small text-muted">{hintText}</span>}
            </span>
            <Button size="sm" variant="outline-primary" disabled={disabled} onClick={openPicker}>{buttonText || t('upload.browse')}</Button>
          </>
        ) : (
          <>
            <div className="rc-drop-icon mb-2"><UploadIcon /></div>
            <div className="fw-semibold">{over ? t('upload.dropNow') : (title || t('upload.dropHere'))}</div>
            <div className="small text-muted my-1">{t('upload.or')}</div>
            <Button size="sm" variant="outline-primary" disabled={disabled} onClick={openPicker}>{buttonText || t('upload.browse')}</Button>
            {hintText && <div id={`${fieldId}-hint`} className="small text-muted mt-2">{hintText}</div>}
            {paste && !disabled && <div className="small text-muted">{t('upload.pasteHint')}</div>}
          </>
        )}
      </div>
      {error && <div className="invalid-feedback d-block">{error}</div>}

      {files.length > 0 && (
        <div className="d-flex flex-wrap align-items-center gap-2 mt-2 small">
          <span className="text-muted">{t('upload.summary', { count: counted.length, size: formatBytes(totalSize, locale) })}</span>
          {uploading.length > 0 && (
            <span className="d-flex align-items-center gap-2 flex-grow-1" style={{ minWidth: 120, maxWidth: 260 }}>
              <ProgressBar now={overall} className="rc-progress flex-grow-1" aria-label={t('upload.overall')} />
              <span className="text-muted">{`${overall}%`}</span>
            </span>
          )}
          <span className="ms-auto d-flex gap-2">
            {canUpload && queued.length > 0 && (
              <Button size="sm" variant="primary" onClick={uploadAll} disabled={disabled}>{t('upload.uploadAll', { count: queued.length })}</Button>
            )}
            {failed.length > 1 && canUpload && (
              <Button size="sm" variant="outline-secondary" onClick={() => failed.forEach(retry)}>{t('upload.retryAll')}</Button>
            )}
            <Button size="sm" variant="outline-danger" onClick={clearAll} disabled={disabled}>{t('upload.clearAll')}</Button>
          </span>
        </div>
      )}
      {listView}
      <div className="visually-hidden" aria-live="polite">{announce}</div>
      {overPage && <div className="rc-upload-overlay">{t('upload.dropAnywhere', { label: label || t('upload.files') })}</div>}

      <Modal show={Boolean(previewing)} onHide={() => setPreviewing(null)} size="lg" centered>
        <Modal.Header closeButton><Modal.Title as="h6" className="text-truncate">{previewing?.name}</Modal.Title></Modal.Header>
        <Modal.Body className="text-center">
          {previewing && <img src={previewing.thumb || previewing.url} alt={previewing.name} style={{ maxWidth: '100%', maxHeight: '70vh' }} />}
        </Modal.Body>
      </Modal>
    </Form.Group>
  );
});
