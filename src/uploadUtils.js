// Small file helpers shared by the upload field (upload.js) and the tree / file explorer (tree.js)

export const formatBytes = (bytes, locale) => {
  if (bytes === undefined || bytes === null || Number.isNaN(Number(bytes))) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = Number(bytes);
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i += 1; }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: i ? 1 : 0 }).format(n)} ${units[i]}`;
};

export const extOf = (name) => (/\.([a-z0-9]{1,5})$/i.exec(String(name || ''))?.[1] || 'file').toUpperCase();
export const isImage = (entry) => /^image\//.test(entry.type || '') || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(entry.name || '');
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
