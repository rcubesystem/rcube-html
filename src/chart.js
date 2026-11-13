import { registerComponent } from "./html";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./ui";
import { useTranslator } from "./i18n";
import { formatValue, matchesRule } from "./tableUtils";
import { CHART_COLORS } from "./palette";

/*
 * Chart — schema-driven SVG chart (no chart library).
 *
 * { "type": "Chart", "id": "sales", "props": {
 *     "chartType": "bar",               // bar | line | area | pie | donut | scatter
 *     "horizontal": false, "stacked": false,
 *     "title": "Sales", "subtitle": "Last 6 months", "height": 300,
 *     "labels": ["Jan", "Feb", "Mar"],
 *     "series": [ { "key": "online", "name": "Online", "data": [12, 19, 7] },
 *                 { "key": "target", "name": "Target", "type": "line", "data": [10, 15, 15] } ],   // combo
 *     "format": "currency", "currency": "USD", "decimals": 0,
 *     "yAxis": { "title": "Revenue", "min": 0, "max": 100 }, "xAxis": { "title": "Month" },
 *     "grid": true, "rulers": [ { "value": 15, "label": "Goal" } ], "bands": [ { "from": 0, "to": 5 } ],
 *     "dataLabels": "last", "tooltip": true, "legend": "top", "legendToggle": true, "tableToggle": true,
 *     "animate": true, "hover": "fade", "hoverColor": "#ffb000",
 *     "highlight": { "series": "online", "index": 1 }, "highlightColor": "#e34948",
 *     "pointRules": [ { "when": { "gt": 15 }, "color": "#008300" } ],
 *     "onPointClick": "pointClicked()", "onPointHover": "pointHovered()", "onLegendClick": "legendClicked()" } }
 *
 * Data changed at runtime lives in the form's element state
 * (actions.setChartData, setChartValue, addChartPoint, removeChartPoint, setChartType, highlightChart, toggleSeries, ...).
 */

// Categorical palette (fixed order; color follows the series, never its position among visible ones)
export { CHART_COLORS } from "./palette";
const CHART_COLORS_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

const CHART_CSS = `
.rcube-chart{${CHART_COLORS.map((c, i) => `--rc-s${i + 1}:${c};`).join('')}position:relative}
[data-bs-theme=dark] .rcube-chart{${CHART_COLORS_DARK.map((c, i) => `--rc-s${i + 1}:${c};`).join('')}}
.rcube-chart svg{display:block;overflow:visible;touch-action:pan-y}
.rcube-chart svg:focus{outline:none}
.rcube-chart svg:focus-visible{outline:2px solid var(--rc-primary);outline-offset:4px;border-radius:4px}
.rcube-chart .rc-legend-item{background:none;border:0;padding:2px 6px;border-radius:4px;color:var(--rc-secondary-color);font-size:.8125rem;display:inline-flex;align-items:center;gap:6px}
.rcube-chart .rc-legend-item:hover{background:var(--rc-tertiary-bg)}
.rcube-chart .rc-legend-item[aria-pressed=false]{opacity:.45;text-decoration:line-through}
.rcube-chart .rc-chart-tip{position:absolute;pointer-events:none;z-index:5;min-width:120px;padding:6px 10px;font-size:.8125rem;
  background:var(--rc-body-bg);color:var(--rc-body-color);border:1px solid var(--rc-border-color-translucent);border-radius:6px;
  box-shadow:0 4px 12px rgba(0,0,0,.12);white-space:nowrap}
.rcube-chart .rc-chart-tip-row{display:flex;align-items:center;gap:8px;line-height:1.5}
.rcube-chart .rc-chart-tip-row .rc-name{color:var(--rc-secondary-color)}
`;

const INK = 'var(--rc-body-color)';
const MUTED = 'var(--rc-secondary-color)';
const GRID = 'var(--rc-border-color-translucent)';
const AXIS = 'var(--rc-border-color)';
const SURFACE = 'var(--rc-body-bg)';

// ---------------------------------------------------------------- helpers

const num = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
// Cartesian / pie data points: 12 or { "value": 12 }
const valueOf = (d) => (d !== null && typeof d === 'object' ? num(d.value ?? d.y) : num(d));
// Rough text width for layout (12px system sans)
const textWidth = (s, size = 12) => String(s ?? '').length * size * 0.58;
const ease = (p) => 1 - (1 - p) ** 3;

// Clean tick values: 0 / 20 / 40 ... covering [min, max]
const niceStep = (span, count) => {
  const raw = span / Math.max(1, count);
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
};
const niceScale = (lo, hi, count = 5, fixedMin, fixedMax) => {
  let min = fixedMin ?? lo;
  let max = fixedMax ?? hi;
  if (min === max) { max = min + 1; if (min > 0 && fixedMin === undefined) min = 0; }
  const step = niceStep(max - min, count);
  if (fixedMin === undefined) min = Math.floor(min / step) * step;
  if (fixedMax === undefined) max = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step / 1e6; v += step) ticks.push(+v.toFixed(10));
  return { min, max, ticks };
};

// Straight or smooth (Catmull-Rom) path through points
const linePath = (pts, smooth) => {
  if (!pts.length) return '';
  if (!smooth || pts.length < 3) return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join('');
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    d += `C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6},${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6},${p2[0]},${p2[1]}`;
  }
  return d;
};

// Runs of consecutive non-null indexes (a null value breaks a line)
const runsOf = (values) => {
  const runs = [];
  let run = [];
  values.forEach((v, i) => {
    if (v === null) { if (run.length) runs.push(run); run = []; } else run.push(i);
  });
  if (run.length) runs.push(run);
  return runs;
};

// Bar with a 4px rounded data end and a square baseline end. c = category axis, v = value axis.
const barPath = (horizontal, c0, size, base, end, round) => {
  const dir = Math.sign(end - base) || -1;
  const r = round ? Math.min(4, size / 2, Math.abs(end - base)) : 0;
  const p = (c, v) => (horizontal ? `${v},${c}` : `${c},${v}`);
  return r
    ? `M${p(c0, base)}L${p(c0, end - dir * r)}Q${p(c0, end)} ${p(c0 + r, end)}L${p(c0 + size - r, end)}Q${p(c0 + size, end)} ${p(c0 + size, end - dir * r)}L${p(c0 + size, base)}Z`
    : `M${p(c0, base)}L${p(c0, end)}L${p(c0 + size, end)}L${p(c0 + size, base)}Z`;
};

const arcPath = (cx, cy, r0, r1, a0, a1) => {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const pt = (r, a) => `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  if (a1 - a0 >= Math.PI * 2 - 1e-6) a1 = a0 + Math.PI * 2 - 1e-4; // full circle
  return r0 > 0
    ? `M${pt(r1, a0)}A${r1},${r1} 0 ${large} 1 ${pt(r1, a1)}L${pt(r0, a1)}A${r0},${r0} 0 ${large} 0 ${pt(r0, a0)}Z`
    : `M${cx},${cy}L${pt(r1, a0)}A${r1},${r1} 0 ${large} 1 ${pt(r1, a1)}Z`;
};

// Animate a number matrix from what is on screen to the new target (enter from 0)
const useTween = (target, enabled, duration) => {
  const key = JSON.stringify(target);
  const [frame, setFrame] = useState(() => (enabled ? target.map((row) => row.map((v) => (v === null ? null : 0))) : target));
  const shown = useRef(frame);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!enabled || reduce) { shown.current = target; setFrame(target); return undefined; }
    const from = shown.current;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const e = ease(p);
      const next = target.map((row, i) => row.map((v, j) => {
        if (v === null) return null;
        const a = from[i]?.[j] ?? 0;
        return a + (v - a) * e;
      }));
      shown.current = next;
      setFrame(next);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, duration]);
  // Series / points added or removed: draw the new shape until the next frame arrives
  const sameShape = frame.length === target.length && frame.every((row, i) => row.length === target[i].length);
  return sameShape ? frame : target;
};

const useWidth = (ref) => {
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
};

// Short colored stroke (tooltip rows, line legend) or swatch (bars, areas, slices)
const Key = ({ color, line, dot }) => (
  <span aria-hidden="true" style={line
    ? { width: 14, height: 2, borderRadius: 1, background: color, flex: 'none' }
    : { width: 10, height: 10, borderRadius: dot ? '50%' : 2, background: color, flex: 'none' }} />
);

// ---------------------------------------------------------------- component

export const Chart = ({
  nodeId, actions,
  chartType = 'bar', horizontal = false, stacked = false,
  labels = [], series = [], colors,
  title, subtitle, height = 300, emptyText,
  format, currency, decimals, locale,
  xAxis = {}, yAxis = {}, grid = true, rulers = [], bands = [],
  legend = 'top', legendToggle = true, tooltip = true, crosshair, tableToggle = false,
  dataLabels = false, markers, smooth = false, areaOpacity, barWidth = 24,
  innerRadius = 0.6, centerText,
  animate = true, animationDuration = 600,
  hover: hoverMode = 'fade', hoverColor, highlight, highlightColor, pointRules = [],
  hiddenSeries,
  className = '', style,
  onPointClick, onPointHover, onLegendClick,
}) => {
  const t = useTranslator();
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null); // { index, series, x, y }
  const hoverRef = useRef(null);
  const [showTable, setShowTable] = useState(false);
  const [ownHidden, setOwnHidden] = useState(hiddenSeries || []);

  const isPie = chartType === 'pie' || chartType === 'donut';
  const isScatter = chartType === 'scatter';
  const valueFormat = { format: format || 'number', currency, decimals, locale };
  const fmt = (v, f = valueFormat) => (v === null || v === undefined ? '–' : formatValue(v, f, t));

  // Series with stable key, name, color slot and mark kind
  const seriesList = useMemo(() => series.map((s, i) => ({
    ...s,
    key: String(s.key ?? s.name ?? `s${i}`),
    name: s.name ?? s.key ?? `Series ${i + 1}`,
    color: s.color || colors?.[i] || `var(--rc-s${(i % 8) + 1})`,
    kind: s.type || (chartType === 'area' ? 'area' : chartType === 'line' ? 'line' : 'bar'),
  })), [series, colors, chartType]);

  // Hidden series (or pie slices by label): the form's element state when in a form, else local
  const hidden = new Set((actions?.toggleSeries ? hiddenSeries : ownHidden) || []);
  const toggleHidden = (key) => {
    const nowHidden = !hidden.has(key);
    if (legendToggle) {
      if (actions?.toggleSeries) actions.toggleSeries(nodeId, key);
      else setOwnHidden((prev) => (nowHidden ? [...prev, key] : prev.filter((k) => k !== key)));
    }
    onLegendClick?.({ chart: nodeId, series: key, hidden: legendToggle ? nowHidden : hidden.has(key) });
  };

  const count = Math.max(labels.length, ...seriesList.map((s) => s.data?.length || 0), 0);
  const pieSeries = seriesList[0];
  const pieLabels = isPie ? Array.from({ length: count }, (_, i) => String(labels[i] ?? i + 1)) : [];

  // Target numbers -> animated frame. Scatter rows are [x0, y0, x1, y1, ...]
  const target = useMemo(() => {
    if (isPie) return [Array.from({ length: count }, (_, i) => (hidden.has(pieLabels[i]) ? 0 : Math.max(0, valueOf(pieSeries?.data?.[i]) ?? 0)))];
    if (isScatter) return seriesList.map((s) => (s.data || []).flatMap((p) => [num(p?.x), num(p?.y)]));
    return seriesList.map((s) => Array.from({ length: count }, (_, i) => valueOf(s.data?.[i])));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesList, count, isPie, isScatter, JSON.stringify([...hidden])]);
  const frame = useTween(target, animate, animationDuration);

  // ---------------------------------------------------------------- looks
  const highlights = highlight ? (Array.isArray(highlight) ? highlight : [highlight]) : [];
  const isHighlighted = (key, i) => highlights.some((h) => (h.series == null || String(h.series) === key)
    && (h.index == null || Number(h.index) === i)
    && (h.label == null || String(h.label) === String(labels[i])));
  const ruleColor = (key, i, value) => pointRules.find((rule) => matchesRule(rule.when, { value, label: labels[i], series: key, index: i }, 'value'))?.color;

  // Fill / opacity of one mark: rule color -> highlight -> hover
  const markLook = (key, i, value, baseColor) => {
    const hl = highlights.length > 0 && isHighlighted(key, i);
    const hovered = hover && hover.index === i && (!hover.series || hover.series === key);
    let fill = ruleColor(key, i, value) ?? baseColor;
    if (hl && highlightColor) fill = highlightColor;
    if (hovered && hoverColor) fill = hoverColor;
    let opacity = highlights.length > 0 && !hl ? 0.35 : 1;
    if (hover && hoverMode === 'fade') {
      if (hover.index !== i) opacity *= 0.45;
      else if (hover.series && hover.series !== key) opacity *= 0.7;
    }
    return {
      fill,
      opacity,
      filter: hovered && hoverMode === 'lighten' ? 'brightness(1.15)' : undefined,
      transition: 'opacity 150ms ease, fill 150ms ease',
    };
  };

  const wantsLabel = (values, i) => {
    if (!dataLabels || values[i] === null || values[i] === undefined) return false;
    if (dataLabels === true || dataLabels === 'all') return true;
    const valid = values.map((v, j) => [v, j]).filter(([v]) => v !== null && v !== undefined);
    if (dataLabels === 'last') return valid[valid.length - 1]?.[1] === i;
    const max = Math.max(...valid.map(([v]) => v));
    const min = Math.min(...valid.map(([v]) => v));
    if (dataLabels === 'max') return values[i] === max && valid.find(([v]) => v === max)[1] === i;
    if (dataLabels === 'minmax') return (values[i] === max && valid.find(([v]) => v === max)[1] === i)
      || (values[i] === min && valid.find(([v]) => v === min)[1] === i);
    return false;
  };

  // ---------------------------------------------------------------- events
  const payloadFor = (h) => {
    if (!h) return null;
    if (isPie) {
      const total = target[0].reduce((a, b) => a + b, 0);
      const value = target[0][h.index];
      return { chart: nodeId, index: h.index, label: pieLabels[h.index], series: pieSeries?.key, value, percent: total ? value / total : 0 };
    }
    if (isScatter) {
      const s = seriesList.find((x) => x.key === h.series);
      const point = s?.data?.[h.index] || {};
      return { chart: nodeId, index: h.index, series: s?.key, seriesName: s?.name, label: point.label, x: point.x, y: point.y, value: point.y, point };
    }
    const s = h.series ? seriesList.find((x) => x.key === h.series) : null;
    const values = Object.fromEntries(seriesList.map((x, j) => [x.key, target[j][h.index]]));
    return { chart: nodeId, index: h.index, label: labels[h.index], series: s?.key ?? null, seriesName: s?.name, value: s ? values[s.key] : null, values };
  };

  const hoverAt = (next) => {
    const prev = hoverRef.current;
    hoverRef.current = next;
    setHover(next);
    const changed = (prev?.index ?? null) !== (next?.index ?? null) || (prev?.series ?? null) !== (next?.series ?? null);
    if (changed && next) onPointHover?.(payloadFor(next));
  };

  const pointer = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const click = () => {
    if (hoverRef.current) onPointClick?.(payloadFor(hoverRef.current));
  };

  // ---------------------------------------------------------------- render pieces
  const visibleSeries = seriesList.filter((s) => !hidden.has(s.key));
  const empty = count === 0 || (isPie ? target[0].every((v) => !v) : visibleSeries.length === 0);

  const legendItems = isPie
    ? pieLabels.map((label, i) => ({ key: label, name: label, color: colors?.[i] || `var(--rc-s${(i % 8) + 1})`, line: false }))
    : seriesList.map((s) => ({ key: s.key, name: s.name, color: s.color, line: !isScatter && s.kind === 'line', dot: isScatter }));
  const showLegend = legend !== false && (isPie || seriesList.length > 1);
  const legendView = showLegend && (
    <div className={`rc-d-flex rc-flex-wrap rc-gap-1 ${legend === 'bottom' ? 'rc-mt-2' : 'rc-mb-2'}`} role="group" aria-label={title ? `${title} legend` : 'Legend'}>
      {legendItems.map((item) => (
        <button key={item.key} type="button" className="rc-legend-item" aria-pressed={!hidden.has(item.key)}
          onClick={() => toggleHidden(item.key)} disabled={!legendToggle && !onLegendClick}>
          <Key color={item.color} line={item.line} dot={item.dot} />{item.name}
        </button>
      ))}
    </div>
  );

  let svgBody = null;
  let tooltipView = null;
  let handlers = {};

  const tooltipBox = (h, header, rows) => {
    if (!tooltip || !h) return null;
    const flip = h.x + 220 > width;
    return (
      <div className="rc-chart-tip" role="status" style={{
        left: flip ? h.x - 14 : h.x + 14, top: Math.max(0, h.y - 12), transform: flip ? 'translateX(-100%)' : undefined,
      }}>
        {header !== undefined && header !== null && <div className="rc-fw-semibold rc-mb-1">{String(header)}</div>}
        {rows.map((row) => (
          <div key={row.key} className="rc-chart-tip-row" style={row.active ? { fontWeight: 600 } : undefined}>
            {row.color && <Key color={row.color} line />}
            <strong>{row.value}</strong>
            <span className="rc-name">{row.name}</span>
          </div>
        ))}
      </div>
    );
  };

  // ================================================================ pie / donut
  if (isPie && !empty) {
    const values = frame[0];
    const total = values.reduce((a, b) => a + (b || 0), 0) || 1;
    const top = 8;
    const r1 = Math.max(40, Math.min(width, height) / 2 - 16);
    const r0 = chartType === 'donut' ? r1 * innerRadius : 0;
    const cx = width / 2;
    const cy = top + r1 + 4;
    let angle = -Math.PI / 2;
    const slices = values.map((v, i) => {
      const a0 = angle;
      const a1 = angle + ((v || 0) / total) * Math.PI * 2;
      angle = a1;
      return { i, v, a0, a1 };
    });
    const targetTotal = target[0].reduce((a, b) => a + b, 0);
    svgBody = (
      <g>
        {slices.map(({ i, v, a0, a1 }) => {
          if (!v) return null;
          const look = markLook(pieSeries?.key, i, target[0][i], legendItems[i].color);
          const mid = (a0 + a1) / 2;
          const lift = hover?.index === i ? 6 : 0;
          const share = targetTotal ? target[0][i] / targetTotal : 0;
          const labelR = r0 ? (r0 + r1) / 2 : r1 * 0.62;
          const showLabel = dataLabels && a1 - a0 > 0.35;
          const darkInk = !colors?.[i] && i % 8 === 3; // yellow slot takes near-black text
          return (
            <g key={i} style={{ transform: `translate(${Math.cos(mid) * lift}px, ${Math.sin(mid) * lift}px)`, transition: 'transform 150ms ease' }}>
              <path d={arcPath(cx, cy, r0, r1, a0, a1)} data-index={i}
                style={{ ...look, stroke: SURFACE, strokeWidth: 2, cursor: onPointClick ? 'pointer' : undefined }} />
              {showLabel && (
                <text x={cx + Math.cos(mid) * labelR} y={cy + Math.sin(mid) * labelR + 4} textAnchor="middle"
                  fontSize="12" fontWeight="600" fill={darkInk ? '#0b0b0b' : '#ffffff'} pointerEvents="none">
                  {dataLabels === 'value' ? fmt(target[0][i]) : `${Math.round(share * 100)}%`}
                </text>
              )}
            </g>
          );
        })}
        {chartType === 'donut' && (
          <g pointerEvents="none">
            <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="600" fill={INK}>
              {centerText ?? fmt(targetTotal)}
            </text>
            {centerText === undefined && <text x={cx} y={cy + 16} textAnchor="middle" fontSize="12" fill={MUTED}>{t('chart.total')}</text>}
          </g>
        )}
      </g>
    );
    handlers = {
      onPointerMove: (e) => {
        const index = e.target?.dataset?.index;
        if (index === undefined) { if (hoverRef.current) hoverAt(null); return; }
        const [x, y] = pointer(e);
        hoverAt({ index: Number(index), series: null, x, y });
      },
    };
    if (hover) {
      const share = targetTotal ? target[0][hover.index] / targetTotal : 0;
      tooltipView = tooltipBox(hover, null, [{
        key: 'v', color: legendItems[hover.index]?.color, value: `${fmt(target[0][hover.index])} (${Math.round(share * 100)}%)`, name: pieLabels[hover.index],
      }]);
    }
  }

  // ================================================================ cartesian / scatter
  if (!isPie && !empty) {
    const vertical = !horizontal || isScatter;
    const yFormat = { ...valueFormat, ...(yAxis.format && { format: yAxis.format }), ...(yAxis.currency && { currency: yAxis.currency }) };
    const xFormat = { ...valueFormat, format: xAxis.format || 'number', ...(xAxis.currency && { currency: xAxis.currency }) };

    // Value domain (from target values, so the axis doesn't wobble while animating)
    const visibleIdx = seriesList.map((s, j) => (hidden.has(s.key) ? -1 : j)).filter((j) => j >= 0);
    let lo = Infinity;
    let hi = -Infinity;
    const take = (v) => { if (v !== null && v !== undefined) { lo = Math.min(lo, v); hi = Math.max(hi, v); } };
    let xlo = Infinity;
    let xhi = -Infinity;
    if (isScatter) {
      visibleIdx.forEach((j) => target[j].forEach((v, k) => {
        if (k % 2) take(v); else if (v !== null) { xlo = Math.min(xlo, v); xhi = Math.max(xhi, v); }
      }));
    } else {
      for (let i = 0; i < count; i += 1) {
        let pos = 0;
        let neg = 0;
        visibleIdx.forEach((j) => {
          const v = target[j][i];
          const s = seriesList[j];
          if (stacked && s.kind !== 'line') { if (v > 0) pos += v; else if (v < 0) neg += v; } else take(v);
        });
        if (stacked) { take(pos); take(neg); }
      }
      take(0); // bars and areas grow from 0
    }
    rulers.filter((r) => (r.axis || 'y') === 'y').forEach((r) => take(num(r.value)));
    if (lo === Infinity) { lo = 0; hi = 1; }
    const vScale = niceScale(lo, hi, yAxis.ticks ?? 5, num(yAxis.min) ?? undefined, num(yAxis.max) ?? undefined);
    const xScale = isScatter ? niceScale(xlo === Infinity ? 0 : xlo, xhi === -Infinity ? 1 : xhi, xAxis.ticks ?? 6, num(xAxis.min) ?? undefined, num(xAxis.max) ?? undefined) : null;

    // Axis ticks: compact on an axis that reaches 10,000
    const tickFmt = (f, scale) => (v) => {
      const reach = Math.max(Math.abs(scale.min), Math.abs(scale.max));
      if (reach >= 10000 && ['number', 'currency'].includes(f.format)) {
        return new Intl.NumberFormat(f.locale, { notation: 'compact', maximumFractionDigits: 1, ...(f.format === 'currency' && { style: 'currency', currency: f.currency || 'USD' }) }).format(v);
      }
      return formatValue(v, { ...f, decimals: f.decimals ?? (Number.isInteger(v) ? 0 : undefined) }, t);
    };
    const vTick = tickFmt(yFormat, vScale);
    const xTick = isScatter ? tickFmt(xFormat, xScale) : null;

    // Margins
    const showY = yAxis.show !== false;
    const showX = xAxis.show !== false;
    const catLabels = Array.from({ length: count }, (_, i) => String(labels[i] ?? i + 1));
    const vTickW = Math.max(...vScale.ticks.map((v) => textWidth(vTick(v))));
    const endLabelW = dataLabels === 'last' && visibleSeries.some((s) => s.kind !== 'bar') ? 56 : 0;
    const left = 8 + (vertical
      ? (showY ? vTickW + 10 : 0) + (yAxis.title ? 18 : 0)
      : (showX ? Math.min(140, Math.max(...catLabels.map((l) => textWidth(l)))) + 10 : 0) + (xAxis.title ? 18 : 0));
    const right = 12 + endLabelW + (vertical ? 0 : (dataLabels ? 40 : 0));
    const top = 12 + (rulers.some((r) => r.label) && !vertical ? 14 : 0);
    const bottom = (vertical ? (showX ? 24 : 6) + (xAxis.title ? 18 : 0) : (showY ? 24 : 6) + (yAxis.title ? 18 : 0));
    const pw = Math.max(40, width - left - right);
    const ph = Math.max(40, height - top - bottom);

    // Scales
    const vmin = vScale.min;
    const vmax = vScale.max;
    const valPx = vertical
      ? (v) => top + ph * (1 - (v - vmin) / (vmax - vmin || 1))
      : (v) => left + pw * ((v - vmin) / (vmax - vmin || 1));
    const catLen = vertical ? pw : ph;
    const catStart = vertical ? left : top;
    const band = catLen / Math.max(1, count);
    const catPos = (i) => catStart + band * (i + 0.5);
    const xPx = isScatter ? (v) => left + pw * ((v - xScale.min) / (xScale.max - xScale.min || 1)) : null;
    const xy = (c, v) => (vertical ? [c, v] : [v, c]);
    const baseVal = vmin > 0 ? vmin : vmax < 0 ? vmax : 0;
    const basePx = valPx(baseVal);

    const gridOpts = typeof grid === 'object' && grid !== null ? grid : { value: Boolean(grid), category: false };
    const pieces = [];

    // Bands (shaded value ranges) and value gridlines
    bands.forEach((b, k) => {
      const a = valPx(Math.max(vmin, Math.min(vmax, num(b.from) ?? vmin)));
      const z = valPx(Math.max(vmin, Math.min(vmax, num(b.to) ?? vmax)));
      const [x0, y0] = xy(catStart, Math.min(a, z));
      pieces.push(
        <g key={`band${k}`}>
          <rect x={x0} y={y0} width={vertical ? pw : Math.abs(z - a)} height={vertical ? Math.abs(z - a) : ph}
            style={{ fill: b.color || 'var(--rc-secondary-color)', opacity: b.opacity ?? 0.08 }} />
          {b.label && (
            <text x={vertical ? left + 6 : x0 + 4} y={vertical ? y0 + 14 : top - 4} fontSize="11" fill={MUTED}>{b.label}</text>
          )}
        </g>
      );
    });
    if (gridOpts.value !== false) {
      vScale.ticks.forEach((v) => {
        const p = valPx(v);
        const [x1, y1] = xy(catStart, p);
        const [x2, y2] = xy(catStart + catLen, p);
        pieces.push(<line key={`g${v}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GRID} strokeWidth="1" />);
      });
    }
    if (gridOpts.category && !isScatter) {
      catLabels.forEach((_, i) => {
        const [x1, y1] = xy(catPos(i), valPx(vmin));
        const [x2, y2] = xy(catPos(i), valPx(vmax));
        pieces.push(<line key={`gc${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={GRID} strokeWidth="1" />);
      });
    }
    if (isScatter && gridOpts.category) {
      xScale.ticks.forEach((v) => pieces.push(<line key={`gx${v}`} x1={xPx(v)} y1={top} x2={xPx(v)} y2={top + ph} stroke={GRID} strokeWidth="1" />));
    }

    // Value axis ticks (yAxis is always the value axis, xAxis the category axis)
    if (showY) {
      vScale.ticks.forEach((v) => {
        const p = valPx(v);
        pieces.push(vertical
          ? <text key={`t${v}`} x={left - 8} y={p + 4} textAnchor="end" fontSize="12" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{vTick(v)}</text>
          : <text key={`t${v}`} x={p} y={top + ph + 16} textAnchor="middle" fontSize="12" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{vTick(v)}</text>);
      });
    }

    // Category axis labels (thinned so they never overlap)
    if (!isScatter && showX) {
      const widest = Math.max(...catLabels.map((l) => textWidth(l))) + 10;
      const every = vertical ? Math.max(1, Math.ceil(widest / band)) : Math.max(1, Math.ceil(16 / band));
      catLabels.forEach((label, i) => {
        if (i % every) return;
        pieces.push(vertical
          ? <text key={`c${i}`} x={catPos(i)} y={top + ph + 16} textAnchor="middle" fontSize="12" fill={MUTED}>{label}</text>
          : <text key={`c${i}`} x={left - 8} y={catPos(i) + 4} textAnchor="end" fontSize="12" fill={MUTED}>{label}</text>);
      });
    }
    if (isScatter && showX) {
      xScale.ticks.forEach((v) => pieces.push(
        <text key={`xt${v}`} x={xPx(v)} y={top + ph + 16} textAnchor="middle" fontSize="12" fill={MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>{xTick(v)}</text>
      ));
    }

    // Axis titles
    const valueTitle = yAxis.title;
    const catTitle = xAxis.title;
    if (valueTitle) {
      pieces.push(vertical
        ? <text key="vt" transform={`translate(12 ${top + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={MUTED}>{valueTitle}</text>
        : <text key="vt" x={left + pw / 2} y={height - 4} textAnchor="middle" fontSize="12" fill={MUTED}>{valueTitle}</text>);
    }
    if (catTitle) {
      pieces.push(vertical
        ? <text key="ct" x={left + pw / 2} y={height - 4} textAnchor="middle" fontSize="12" fill={MUTED}>{catTitle}</text>
        : <text key="ct" transform={`translate(12 ${top + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={MUTED}>{catTitle}</text>);
    }

    // Baseline
    {
      const [x1, y1] = xy(catStart, basePx);
      const [x2, y2] = xy(catStart + catLen, basePx);
      pieces.push(<line key="base" x1={x1} y1={y1} x2={x2} y2={y2} stroke={AXIS} strokeWidth="1" />);
    }

    // Crosshair (line / area by default)
    const hasLines = visibleSeries.some((s) => s.kind !== 'bar');
    const showCrosshair = !isScatter && (crosshair ?? hasLines) && hover;
    if (showCrosshair) {
      const [x1, y1] = xy(catPos(hover.index), valPx(vmin));
      const [x2, y2] = xy(catPos(hover.index), valPx(vmax));
      pieces.push(<line key="cross" x1={x1} y1={y1} x2={x2} y2={y2} stroke={MUTED} strokeWidth="1" pointerEvents="none" />);
    }

    // ------------------------------------------------ bars
    const barIdx = visibleIdx.filter((j) => seriesList[j].kind === 'bar');
    if (!isScatter && barIdx.length) {
      const k = stacked ? 1 : barIdx.length;
      const bw = Math.max(2, Math.min(barWidth, (band * 0.8 - 2 * (k - 1)) / k));
      const groupW = k * bw + (k - 1) * 2;
      for (let i = 0; i < count; i += 1) {
        let posAcc = 0;
        let negAcc = 0;
        const lastPos = stacked ? [...barIdx].reverse().find((j) => target[j][i] > 0) : null;
        const lastNeg = stacked ? [...barIdx].reverse().find((j) => target[j][i] < 0) : null;
        barIdx.forEach((j, slot) => {
          const s = seriesList[j];
          const v = frame[j][i];
          const tv = target[j][i];
          if (v === null || tv === null) return;
          let from = baseVal;
          let to = v;
          let first = true;
          if (stacked) {
            if (tv >= 0) { from = posAcc; to = posAcc + v; first = posAcc === 0; posAcc = to; } else { from = negAcc; to = negAcc + v; first = negAcc === 0; negAcc = to; }
          }
          let p0 = valPx(from);
          const p1 = valPx(to);
          if (!first) p0 += Math.sign(p1 - p0) * 2; // 2px surface gap between stacked segments
          if (Math.abs(p1 - p0) < 0.5 && !first) return;
          const c0 = stacked ? catPos(i) - bw / 2 : catPos(i) - groupW / 2 + slot * (bw + 2);
          const round = !stacked || j === (tv >= 0 ? lastPos : lastNeg);
          pieces.push(
            <path key={`b${j}-${i}`} d={barPath(!vertical, c0, bw, p0, p1, round)} data-series={s.key}
              style={{ ...markLook(s.key, i, tv, s.color), cursor: onPointClick ? 'pointer' : undefined }} />
          );
          // Value at the bar tip (a stack shows its total on the outermost segment)
          if (wantsLabel(target[j], i) && (!stacked || round)) {
            const shown = stacked
              ? barIdx.reduce((acc, jj) => (Math.sign(target[jj][i]) === Math.sign(tv) ? acc + (target[jj][i] || 0) : acc), 0)
              : tv;
            const out = Math.sign(p1 - basePx) || -1;
            pieces.push(vertical
              ? <text key={`bl${j}-${i}`} x={c0 + bw / 2} y={p1 + (out < 0 ? -6 : 14)} textAnchor="middle" fontSize="11" fill={INK} pointerEvents="none">{fmt(shown)}</text>
              : <text key={`bl${j}-${i}`} x={p1 + (out > 0 ? 6 : -6)} y={c0 + bw / 2 + 4} textAnchor={out > 0 ? 'start' : 'end'} fontSize="11" fill={INK} pointerEvents="none">{fmt(shown)}</text>);
          }
        });
      }
    }

    // ------------------------------------------------ areas and lines
    const lineIdx = visibleIdx.filter((j) => seriesList[j].kind !== 'bar');
    if (!isScatter && lineIdx.length) {
      const stackBase = Array(count).fill(0);
      const showMarkers = markers ?? count <= 24;
      lineIdx.forEach((j) => {
        const s = seriesList[j];
        const values = frame[j];
        const isArea = s.kind === 'area';
        const stackThis = stacked && isArea;
        const tops = values.map((v, i) => (v === null ? null : stackThis ? stackBase[i] + v : v));
        const bases = values.map((v, i) => (stackThis ? stackBase[i] : baseVal));
        const fade = hover?.series && hover.series !== s.key && hoverMode === 'fade' ? 0.3 : (highlights.length && !highlights.some((h) => h.series == null || String(h.series) === s.key) ? 0.35 : 1);
        runsOf(tops).forEach((run, r) => {
          const topPts = run.map((i) => xy(catPos(i), valPx(tops[i])));
          if (isArea) {
            const basePts = run.map((i) => xy(catPos(i), valPx(bases[i]))).reverse();
            const d = `${linePath(topPts, smooth)}L${basePts[0]}${linePath(basePts, smooth).replace(/^M[^LC]+/, '')}Z`;
            pieces.push(<path key={`a${j}-${r}`} d={d} style={{ fill: s.color, opacity: (areaOpacity ?? (stacked ? 0.45 : 0.12)) * fade, transition: 'opacity 150ms ease' }} pointerEvents="none" />);
          }
          const d = linePath(topPts, smooth);
          pieces.push(
            <g key={`l${j}-${r}`} style={{ opacity: fade, transition: 'opacity 150ms ease' }}>
              <path d={d} fill="none" style={{ stroke: s.color }} strokeWidth={s.strokeWidth ?? 2} strokeLinejoin="round" strokeLinecap="round"
                strokeDasharray={s.dashed ? '6 4' : undefined} pointerEvents="none" />
              {/* wider invisible stroke: the series is easy to point at */}
              <path d={d} fill="none" stroke="transparent" strokeWidth="14" data-series={s.key} />
            </g>
          );
        });
        tops.forEach((v, i) => {
          if (v === null) return;
          const [x, y] = xy(catPos(i), valPx(v));
          const tv = target[j][i];
          const special = ruleColor(s.key, i, tv) || (highlights.length && isHighlighted(s.key, i));
          const atHover = hover?.index === i;
          if (showMarkers || special || atHover) {
            const look = markLook(s.key, i, tv, s.color);
            pieces.push(
              <circle key={`m${j}-${i}`} cx={x} cy={y} r={atHover ? 5 : 4} data-series={s.key}
                style={{ ...look, opacity: hover && hoverMode === 'fade' ? (atHover ? 1 : look.opacity) : look.opacity * fade, stroke: SURFACE, strokeWidth: 2, transition: 'r 150ms ease, opacity 150ms ease' }} />
            );
          }
          if (wantsLabel(target[j], i)) {
            const last = dataLabels === 'last';
            pieces.push(vertical
              ? <text key={`ll${j}-${i}`} x={last ? x + 8 : x} y={last ? y + 4 : y - 10} textAnchor={last ? 'start' : 'middle'} fontSize="11" fill={INK} pointerEvents="none">{fmt(stackThis ? target[j][i] : tv)}</text>
              : <text key={`ll${j}-${i}`} x={x + 8} y={y - 6} fontSize="11" fill={INK} pointerEvents="none">{fmt(tv)}</text>);
          }
        });
        if (stackThis) values.forEach((v, i) => { if (v !== null) stackBase[i] += v; });
      });
    }

    // ------------------------------------------------ scatter
    if (isScatter) {
      visibleIdx.forEach((j) => {
        const s = seriesList[j];
        const row = frame[j];
        for (let k = 0; k < row.length; k += 2) {
          const x = row[k];
          const y = row[k + 1];
          if (x === null || y === null) continue;
          const i = k / 2;
          const look = markLook(s.key, i, target[j][k + 1], s.color);
          const hovered = hover?.series === s.key && hover.index === i;
          const size = num(s.data?.[i]?.size) ?? s.size ?? 5;
          const dim = hover && hoverMode === 'fade' && !hovered ? 0.4 : 1;
          pieces.push(
            <circle key={`p${j}-${i}`} cx={xPx(x)} cy={valPx(y)} r={hovered ? size + 1.5 : size}
              style={{ ...look, opacity: (highlights.length ? look.opacity : 1) * dim, stroke: SURFACE, strokeWidth: 2, transition: 'r 150ms ease, opacity 150ms ease' }} />
          );
          if (wantsLabel(target[j].filter((_, kk) => kk % 2), i) && s.data?.[i]?.label) {
            pieces.push(<text key={`pl${j}-${i}`} x={xPx(x) + size + 4} y={valPx(y) + 4} fontSize="11" fill={INK} pointerEvents="none">{s.data[i].label}</text>);
          }
        }
      });
    }

    // ------------------------------------------------ rulers (reference lines, drawn over the marks)
    rulers.forEach((ruler, k) => {
      const axis = ruler.axis || 'y';
      let x1; let y1; let x2; let y2;
      if (axis === 'y') {
        const v = num(ruler.value);
        if (v === null || v < vmin || v > vmax) return;
        [x1, y1] = xy(catStart, valPx(v));
        [x2, y2] = xy(catStart + catLen, valPx(v));
      } else {
        // x ruler: a category (index / label) or, in scatter, an x value
        const i = isScatter ? null : ruler.index ?? catLabels.indexOf(String(ruler.label ?? ruler.value));
        const c = isScatter ? xPx(num(ruler.value)) : catPos(i);
        if (c === null || Number.isNaN(c) || (!isScatter && i < 0)) return;
        if (isScatter) { x1 = c; x2 = c; y1 = top; y2 = top + ph; } else {
          [x1, y1] = xy(c, valPx(vmin));
          [x2, y2] = xy(c, valPx(vmax));
        }
      }
      const color = ruler.color || MUTED;
      const isH = y1 === y2;
      // Label at the end of the line, or at its start when end-of-line value labels would collide
      const labelAt = ruler.labelAt || (dataLabels === 'last' ? 'start' : 'end');
      pieces.push(
        <g key={`r${k}`} pointerEvents="none">
          <line x1={x1} y1={y1} x2={x2} y2={y2} style={{ stroke: color }} strokeWidth={ruler.width ?? 1.5}
            strokeDasharray={ruler.dashed === false ? undefined : '4 3'} />
          {ruler.label && (isH
            ? <text x={labelAt === 'start' ? x1 + 4 : x2} y={y1 - 5} textAnchor={labelAt === 'start' ? 'start' : 'end'} fontSize="11" fill={MUTED} paintOrder="stroke" stroke={SURFACE} strokeWidth="3">{ruler.label}{ruler.showValue ? ` · ${fmt(num(ruler.value))}` : ''}</text>
            : <text x={x1 + 4} y={Math.min(y1, y2) + 10} fontSize="11" fill={MUTED} paintOrder="stroke" stroke={SURFACE} strokeWidth="3">{ruler.label}</text>)}
        </g>
      );
    });

    svgBody = <g>{pieces}</g>;

    // ------------------------------------------------ pointer: nearest category (or nearest point for scatter)
    const inPlot = (x, y) => x >= left - 4 && x <= left + pw + 4 && y >= top - 4 && y <= top + ph + 4;
    handlers = {
      onPointerMove: (e) => {
        const [x, y] = pointer(e);
        if (!inPlot(x, y)) { if (hoverRef.current) hoverAt(null); return; }
        if (isScatter) {
          let best = null;
          visibleIdx.forEach((j) => {
            for (let k = 0; k < target[j].length; k += 2) {
              if (target[j][k] === null || target[j][k + 1] === null) continue;
              const d = Math.hypot(xPx(target[j][k]) - x, valPx(target[j][k + 1]) - y);
              if (d < 24 && (!best || d < best.d)) best = { d, series: seriesList[j].key, index: k / 2 };
            }
          });
          if (!best) { if (hoverRef.current) hoverAt(null); return; }
          hoverAt({ index: best.index, series: best.series, x, y });
          return;
        }
        const c = vertical ? x : y;
        const index = Math.min(count - 1, Math.max(0, Math.floor((c - catStart) / band)));
        hoverAt({ index, series: e.target?.dataset?.series ?? null, x, y });
      },
    };

    if (hover) {
      if (isScatter) {
        const s = seriesList.find((x) => x.key === hover.series);
        const point = s?.data?.[hover.index] || {};
        tooltipView = tooltipBox(hover, point.label ?? (seriesList.length > 1 ? s?.name : null), [
          { key: 'y', color: s?.color, value: fmt(num(point.y), yFormat), name: yAxis.title || 'y' },
          { key: 'x', value: fmt(num(point.x), xFormat), name: xAxis.title || 'x' },
        ]);
      } else {
        const rows = visibleIdx.map((j) => ({
          key: seriesList[j].key, color: seriesList[j].color, value: fmt(target[j][hover.index]), name: seriesList[j].name,
          active: hover.series === seriesList[j].key,
        }));
        if (stacked && visibleIdx.length > 1) {
          rows.push({ key: '__total', value: fmt(visibleIdx.reduce((a, j) => a + (target[j][hover.index] || 0), 0)), name: t('chart.total') });
        }
        tooltipView = tooltipBox(hover, catLabels[hover.index], rows);
      }
    }
  }

  // Keyboard: arrows move between points, Enter clicks, Escape leaves
  const pointCount = isScatter ? (visibleSeries[0]?.data?.length || 0) : count;
  const onKeyDown = (e) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Enter', ' ', 'Escape'].includes(e.key) || empty) return;
    e.preventDefault();
    if (e.key === 'Escape') { hoverAt(null); return; }
    if (e.key === 'Enter' || e.key === ' ') { click(); return; }
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1;
    const current = hoverRef.current?.index ?? -1;
    const index = (current + step + pointCount) % pointCount;
    hoverAt({ index, series: isScatter ? visibleSeries[0]?.key : null, x: Math.min(width - 40, 40 + (index / Math.max(1, pointCount - 1)) * (width - 80)), y: 20 });
  };

  // ---------------------------------------------------------------- table view
  const tableView = showTable && (
    <div className="rc-table-responsive">
      <table className="rc-table rc-table-sm rc-mb-0">
        {title && <caption className="rc-caption-top">{title}</caption>}
        <thead>
          {isPie ? (
            <tr><th scope="col">{t('chart.category')}</th><th scope="col" className="rc-text-end">{pieSeries?.name}</th></tr>
          ) : isScatter ? (
            <tr><th scope="col" /><th scope="col" className="rc-text-end">{xAxis.title || 'x'}</th><th scope="col" className="rc-text-end">{yAxis.title || 'y'}</th></tr>
          ) : (
            <tr><th scope="col">{xAxis.title || t('chart.category')}</th>{seriesList.map((s) => <th key={s.key} scope="col" className="rc-text-end">{s.name}</th>)}</tr>
          )}
        </thead>
        <tbody style={{ fontVariantNumeric: 'tabular-nums' }}>
          {isPie && pieLabels.map((label, i) => (
            <tr key={label}><td>{label}</td><td className="rc-text-end">{fmt(valueOf(pieSeries?.data?.[i]))}</td></tr>
          ))}
          {isScatter && seriesList.flatMap((s) => (s.data || []).map((p, i) => (
            <tr key={`${s.key}-${i}`}><td>{p?.label ?? s.name}</td><td className="rc-text-end">{fmt(num(p?.x))}</td><td className="rc-text-end">{fmt(num(p?.y))}</td></tr>
          )))}
          {!isPie && !isScatter && Array.from({ length: count }, (_, i) => (
            <tr key={i}><td>{labels[i] ?? i + 1}</td>{seriesList.map((s) => <td key={s.key} className="rc-text-end">{fmt(valueOf(s.data?.[i]))}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div ref={wrapRef} data-rcube-chart={nodeId} className={`rcube-chart rc-mb-3 ${className}`.trim()} style={style}>
      <style>{CHART_CSS}</style>
      {(title || subtitle || tableToggle) && (
        <div className="rc-d-flex rc-align-items-start rc-gap-2 rc-mb-2">
          <div className="rc-me-auto">
            {title && <h6 className="rc-mb-0">{title}</h6>}
            {subtitle && <div className="rc-small" style={{ color: MUTED }}>{subtitle}</div>}
          </div>
          {tableToggle && (
            <Button size="sm" variant="outline-secondary" onClick={() => setShowTable((v) => !v)} aria-pressed={showTable}>
              {showTable ? t('chart.showChart') : t('chart.showTable')}
            </Button>
          )}
        </div>
      )}
      {legend !== 'bottom' && !showTable && legendView}
      {showTable ? tableView : empty ? (
        <div className="rc-d-flex rc-align-items-center rc-justify-content-center rc-text-muted rc-small" style={{ height }}>{emptyText || t('chart.empty')}</div>
      ) : (
        <div style={{ position: 'relative' }}>
          <svg ref={svgRef} width={width} height={height} role="img" tabIndex={0}
            aria-label={[title, subtitle].filter(Boolean).join(' — ') || 'Chart'}
            style={{ fontFamily: 'inherit', cursor: onPointClick && hover ? 'pointer' : undefined }}
            {...handlers}
            onPointerLeave={() => hoverAt(null)} onBlur={() => hoverAt(null)} onClick={click} onKeyDown={onKeyDown}>
            {svgBody}
          </svg>
          {tooltipView}
        </div>
      )}
      {legend === 'bottom' && !showTable && legendView}
    </div>
  );
};

// Schemas use it by name (registered when this module loads: 'rcube-html', or 'rcube-html/chart' with 'rcube-html/core')
registerComponent('Chart', Chart);
