import { useEffect, useMemo, useRef, useState } from "react";
import { Button, ButtonGroup, Form, Modal, Spinner } from "react-bootstrap";
import { useTranslator } from "./i18n";
import { CHART_COLORS } from "./chart";
import {
  CALENDAR_VIEWS, addDays, addMinutes, dayKey, diffDays, expandEvents, minutesOfDay, normalizeEvent,
  parseDate, publicEvent, rangeOf, sameDay, shiftDate, startOfDay, startOfMonth, startOfWeek, toLocalString,
} from "./calendarUtils";

/*
 * Calendar — schema-driven calendar with day / week / month / year / agenda views.
 *
 * { "type": "Calendar", "id": "team-cal", "props": {
 *     "view": "week", "views": ["day", "week", "month", "year", "agenda"], "date": "2026-11-02",
 *     "firstDay": 0, "weekends": true, "height": 680,
 *     "dayStartHour": 0, "dayEndHour": 24, "scrollToHour": 8, "hourHeight": 48, "slotMinutes": 30, "snapMinutes": 15,
 *     "workingHours": { "start": 9, "end": 17, "days": [1, 2, 3, 4, 5] }, "nowIndicator": true,
 *     "calendars": [ { "id": "work", "name": "Work", "color": "#2a78d6" } ],
 *     "events": [ { "id": 1, "title": "Standup", "start": "2026-11-02T09:00", "end": "2026-11-02T09:15", "calendar": "work",
 *                   "recurrence": { "freq": "weekly", "byDay": [1, 2, 3, 4, 5] } },
 *                 { "id": 2, "title": "Offsite", "start": "2026-11-05", "end": "2026-11-06", "allDay": true } ],
 *     "sidebar": true, "searchable": true, "editable": true, "selectable": true, "eventEditor": true, "autoUpdate": true,
 *     "onRangeChange": "loadEvents()",       // on first render and whenever the visible range changes -> fetch events
 *     "onEventClick": "...", "onSlotClick": "...", "onSelect": "...",
 *     "onEventCreate": "...", "onEventUpdate": "...", "onEventDelete": "...", "onViewChange": "...", "onCalendarToggle": "..." } }
 *
 * All-day "end" is the last day (inclusive). view / date / events / loading / hiddenCalendars changed at runtime live in
 * the form's element state (actions.setCalendarEvents, setCalendarView, setCalendarDate, setCalendarLoading, ...).
 */

const CAL_CSS = `
.rcube-cal{display:flex;gap:16px;font-size:.875rem;position:relative}
.rcube-cal .rc-side{width:220px;flex:none}
.rcube-cal .rc-main{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.rcube-cal .rc-body{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;border:1px solid var(--bs-border-color);border-radius:8px;overflow:hidden;background:var(--bs-body-bg);transition:opacity .15s}
.rcube-cal.rc-loading .rc-body{opacity:.6}
.rcube-cal .rc-title{font-size:1.25rem;font-weight:500;margin:0 8px 0 4px;white-space:nowrap}
.rcube-cal .rc-wd-head{display:grid;border-bottom:1px solid var(--bs-border-color)}
.rcube-cal .rc-wd-head div{text-align:center;font-size:.6875rem;font-weight:600;text-transform:uppercase;color:var(--bs-secondary-color);padding:6px 0}
.rcube-cal .rc-month{flex:1;display:flex;flex-direction:column;min-height:0}
.rcube-cal .rc-week{position:relative;flex:1 1 0;min-height:0;border-bottom:1px solid var(--bs-border-color)}
.rcube-cal .rc-month .rc-week:last-child{border-bottom:0}
.rcube-cal .rc-week-bg{position:absolute;inset:0;display:grid}
.rcube-cal .rc-cell{border-right:1px solid var(--bs-border-color);padding:2px 4px;text-align:center}
.rcube-cal .rc-cell:last-child{border-right:0}
.rcube-cal .rc-cell.rc-out{background:var(--bs-tertiary-bg)}
.rcube-cal .rc-out .rc-daynum{color:var(--bs-secondary-color)}
.rcube-cal .rc-cell.rc-sel{background:rgba(var(--bs-primary-rgb),.14)}
.rcube-cal .rc-daynum{border:0;background:none;border-radius:999px;min-width:24px;height:24px;font-size:.75rem;padding:0 6px;color:var(--bs-body-color)}
.rcube-cal .rc-daynum:hover{background:var(--bs-secondary-bg)}
.rcube-cal .rc-today>.rc-daynum{background:var(--bs-primary);color:#fff}
.rcube-cal .rc-week-events{position:absolute;inset:0;pointer-events:none}
.rcube-cal .rc-ev{position:absolute;height:20px;line-height:20px;border-radius:4px;padding:0 6px;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:auto;cursor:pointer;user-select:none}
.rcube-cal .rc-ev-dot:hover{background:var(--bs-secondary-bg)}
.rcube-cal .rc-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:4px;flex:none}
.rcube-cal .rc-ev .rc-time{color:var(--bs-secondary-color);margin-right:4px}
.rcube-cal .rc-ev-bar .rc-time{color:inherit;opacity:.85}
.rcube-cal .rc-cont-l{border-top-left-radius:0;border-bottom-left-radius:0}
.rcube-cal .rc-cont-r{border-top-right-radius:0;border-bottom-right-radius:0}
.rcube-cal .rc-more{position:absolute;height:20px;line-height:20px;font-size:.75rem;font-weight:600;border:0;background:none;padding:0 6px;text-align:left;border-radius:4px;pointer-events:auto;color:var(--bs-body-color)}
.rcube-cal .rc-more:hover{background:var(--bs-secondary-bg)}
.rcube-cal .rc-dragging .rc-ev,.rcube-cal .rc-dragging .rc-tev{pointer-events:none}
.rcube-cal .rc-ghost{box-shadow:0 6px 16px rgba(0,0,0,.25);z-index:4}
.rcube-cal .rc-tg-head,.rcube-cal .rc-allday{display:flex;border-bottom:1px solid var(--bs-border-color)}
.rcube-cal .rc-gutter{width:56px;flex:none}
.rcube-cal .rc-dayhead{flex:1 1 0;min-width:0;text-align:center;padding:6px 0;border:0;background:none;color:var(--bs-body-color)}
.rcube-cal .rc-dayhead .rc-wd{font-size:.6875rem;font-weight:600;text-transform:uppercase;color:var(--bs-secondary-color)}
.rcube-cal .rc-dayhead .rc-dn{font-size:1.25rem;line-height:36px;width:36px;height:36px;border-radius:50%;margin:0 auto}
.rcube-cal .rc-dayhead:hover .rc-dn{background:var(--bs-secondary-bg)}
.rcube-cal .rc-dayhead.rc-today .rc-wd{color:var(--bs-primary)}
.rcube-cal .rc-dayhead.rc-today .rc-dn{background:var(--bs-primary);color:#fff}
.rcube-cal .rc-allday-label{font-size:.6875rem;color:var(--bs-secondary-color);text-align:right;padding:4px 6px}
.rcube-cal .rc-allday .rc-week{border:0}
.rcube-cal .rc-allday .rc-cell{border-right:0;border-left:1px solid var(--bs-border-color)}
.rcube-cal .rc-tg-scroll{flex:1 1 auto;overflow-y:auto;min-height:0}
.rcube-cal .rc-tg{position:relative;display:flex}
.rcube-cal .rc-hours{position:relative;width:56px;flex:none}
.rcube-cal .rc-hours span{position:absolute;right:8px;font-size:.6875rem;color:var(--bs-secondary-color);transform:translateY(-50%);white-space:nowrap}
.rcube-cal .rc-cols{position:relative;flex:1;display:flex;touch-action:none;min-width:0}
.rcube-cal .rc-hline{position:absolute;left:0;right:0;border-top:1px solid var(--bs-border-color);pointer-events:none}
.rcube-cal .rc-hline.rc-half{border-top-style:dotted;opacity:.6}
.rcube-cal .rc-col{position:relative;flex:1 1 0;min-width:0;border-left:1px solid var(--bs-border-color)}
.rcube-cal .rc-off{position:absolute;left:0;right:0;background:var(--bs-tertiary-bg);pointer-events:none}
.rcube-cal .rc-tev{position:absolute;border-radius:4px;padding:1px 6px;font-size:.75rem;overflow:hidden;cursor:pointer;user-select:none;border:1px solid var(--bs-body-bg);line-height:1.3;z-index:1}
.rcube-cal .rc-tev-title{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rcube-cal .rc-tev-time{opacity:.9;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rcube-cal .rc-resize{position:absolute;left:0;right:0;bottom:0;height:6px;cursor:ns-resize}
.rcube-cal .rc-now{position:absolute;left:0;right:0;border-top:2px solid #d03b3b;pointer-events:none;z-index:3}
.rcube-cal .rc-now::before{content:'';position:absolute;left:-6px;top:-6px;width:10px;height:10px;border-radius:50%;background:#d03b3b}
.rcube-cal .rc-selbox{position:absolute;left:2px;right:2px;background:rgba(var(--bs-primary-rgb),.18);border:1px solid var(--bs-primary);border-radius:4px;pointer-events:none;font-size:.75rem;padding:1px 6px;z-index:2}
.rcube-cal .rc-pop{position:absolute;z-index:20;width:300px;max-width:calc(100% - 16px);background:var(--bs-body-bg);border:1px solid var(--bs-border-color);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.18);padding:12px}
.rcube-cal .rc-swatch{width:14px;height:14px;border-radius:4px;flex:none;margin-top:4px}
.rcube-cal .rc-agenda{overflow-y:auto;flex:1}
.rcube-cal .rc-ag-day{display:flex;gap:12px;padding:8px 12px;border-bottom:1px solid var(--bs-border-color)}
.rcube-cal .rc-ag-date{width:110px;flex:none;display:flex;gap:8px;align-items:baseline}
.rcube-cal .rc-ag-date .rc-dn{font-size:1.25rem;width:32px;height:32px;line-height:32px;text-align:center;border-radius:50%}
.rcube-cal .rc-ag-date.rc-today .rc-dn{background:var(--bs-primary);color:#fff}
.rcube-cal .rc-ag-item{display:flex;gap:10px;align-items:center;padding:4px 6px;border-radius:4px;cursor:pointer}
.rcube-cal .rc-ag-item:hover{background:var(--bs-secondary-bg)}
.rcube-cal .rc-mini{font-size:.75rem;user-select:none}
.rcube-cal .rc-mini-grid{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;justify-items:center}
.rcube-cal .rc-mini-grid>span{color:var(--bs-secondary-color);font-size:.6875rem;line-height:24px}
.rcube-cal .rc-mini-grid button{border:0;background:none;width:26px;height:26px;border-radius:50%;font-size:.75rem;padding:0;color:var(--bs-body-color);position:relative}
.rcube-cal .rc-mini-grid button:hover{background:var(--bs-secondary-bg)}
.rcube-cal .rc-mini-grid .rc-out{color:var(--bs-secondary-color)}
.rcube-cal .rc-mini-grid .rc-pick{background:rgba(var(--bs-primary-rgb),.18)}
.rcube-cal .rc-mini-grid .rc-today{background:var(--bs-primary);color:#fff}
.rcube-cal .rc-mini-grid .rc-mark::after{content:'';position:absolute;bottom:1px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--bs-primary)}
.rcube-cal .rc-year{overflow-y:auto;flex:1;padding:12px}
.rcube-cal .rc-iconbtn{border:0;background:none;border-radius:50%;width:32px;height:32px;color:var(--bs-body-color);font-size:1.1rem;line-height:1}
.rcube-cal .rc-iconbtn:hover{background:var(--bs-secondary-bg)}
`;

const LANE = 22; // month / all-day event row height
const DATE_ROW = 26; // space for the date number in a month cell

// Text color on an event's fill: near-black on light fills, white otherwise
const inkOn = (color) => {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color || '');
  if (!m) return '#ffffff';
  const hex = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62 ? '#1f1f1f' : '#ffffff';
};

// Events across a row of days (month week / all-day row): column span + lane per event
const rowSegments = (days, events) => {
  const segs = [];
  events.forEach((ev) => {
    const cols = days.map((d, i) => (ev._start < addDays(d, 1) && ev._end > d ? i : -1)).filter((i) => i >= 0);
    if (!cols.length) return;
    const first = cols[0];
    const last = cols[cols.length - 1];
    segs.push({ ev, start: first, end: last, contLeft: ev._start < days[first], contRight: ev._end > addDays(days[last], 1) });
  });
  segs.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start)
    || Number(b.ev.allDay) - Number(a.ev.allDay) || a.ev._start - b.ev._start);
  const laneEnds = [];
  segs.forEach((seg) => {
    let lane = laneEnds.findIndex((end) => end < seg.start);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(seg.end); } else laneEnds[lane] = seg.end;
    seg.lane = lane;
  });
  return { segs, lanes: laneEnds.length };
};

// Side-by-side columns for overlapping timed events in one day
const layoutDay = (items) => {
  items.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
  let cluster = [];
  let clusterEnd = -1;
  let colEnds = [];
  const flush = () => { cluster.forEach((it) => { it.cols = colEnds.length; }); cluster = []; colEnds = []; };
  items.forEach((it) => {
    if (it.s >= clusterEnd) { flush(); clusterEnd = -1; }
    let col = colEnds.findIndex((end) => end <= it.s);
    if (col < 0) { col = colEnds.length; colEnds.push(it.e); } else colEnds[col] = it.e;
    it.col = col;
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  flush();
  return items;
};

// Size of an element that may mount later (watch: re-observe when this changes, e.g. the view)
const useSize = (ref, watch) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, watch]);
  return size;
};

// Small month grid (sidebar navigator, year view)
const MiniMonth = ({ month, selected, today, firstDay, onPick, onNav, marks, fmt, t }) => {
  const start = startOfWeek(startOfMonth(month), firstDay);
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  return (
    <div className="rc-mini">
      <div className="d-flex align-items-center mb-1">
        <span className="fw-semibold flex-grow-1 ps-1">{fmt.monthYear.format(month)}</span>
        {onNav && (
          <>
            <button type="button" className="rc-iconbtn" style={{ width: 26, height: 26, fontSize: '.9rem' }} aria-label={t('calendar.previous')} onClick={() => onNav(-1)}>‹</button>
            <button type="button" className="rc-iconbtn" style={{ width: 26, height: 26, fontSize: '.9rem' }} aria-label={t('calendar.next')} onClick={() => onNav(1)}>›</button>
          </>
        )}
      </div>
      <div className="rc-mini-grid">
        {days.slice(0, 7).map((d) => <span key={`h${d.getDay()}`}>{fmt.weekdayNarrow.format(d)}</span>)}
        {days.map((d) => {
          const classes = [
            d.getMonth() !== month.getMonth() && 'rc-out',
            sameDay(d, today) ? 'rc-today' : selected && sameDay(d, selected) && 'rc-pick',
            marks?.has(dayKey(d)) && d.getMonth() === month.getMonth() && 'rc-mark',
          ].filter(Boolean).join(' ');
          return (
            <button key={dayKey(d)} type="button" className={classes || undefined} aria-label={fmt.full.format(d)}
              onClick={() => onPick(d)}>{d.getDate()}</button>
          );
        })}
      </div>
    </div>
  );
};

export const Calendar = ({
  nodeId, actions,
  view: viewProp = 'week', views = CALENDAR_VIEWS, date: dateProp,
  events: eventsProp = [], calendars = [], hiddenCalendars: hiddenProp = [], loading: loadingProp = false,
  firstDay = 0, weekends = true, height = 680, hourHeight = 48, dayStartHour = 0, dayEndHour = 24, scrollToHour = 8,
  slotMinutes = 30, snapMinutes = 15, defaultDuration = 60, workingHours, nowIndicator = true, agendaDays = 30,
  locale, hour12,
  sidebar = true, searchable = true, editable = true, selectable = true, eventEditor = true, autoUpdate = true,
  keyboardShortcuts = true,
  className = '', style,
  onRangeChange, onViewChange, onEventClick, onSlotClick, onSelect, onEventCreate, onEventUpdate, onEventDelete, onCalendarToggle,
}) => {
  const t = useTranslator();
  const rootRef = useRef(null);
  const colsRef = useRef(null);
  const scrollRef = useRef(null);
  const monthRef = useRef(null);

  // Runtime values: the form's element state when in a form (props already merged), else local state
  const inForm = Boolean(actions?.setNodeProps && nodeId);
  const [own, setOwn] = useState({});
  const cur = (key, value) => (!inForm && key in own ? own[key] : value);
  const setProps = (patch) => (inForm ? actions.setNodeProps(nodeId, patch) : setOwn((prev) => ({ ...prev, ...patch })));

  const view = views.includes(cur('view', viewProp)) ? cur('view', viewProp) : views[0];
  const today = startOfDay(new Date());
  const dateValue = cur('date', dateProp);
  const date = dateValue ? startOfDay(parseDate(dateValue)) : today;
  const rawEvents = cur('events', eventsProp) || [];
  const hiddenCalendars = (cur('hiddenCalendars', hiddenProp) || []).map(String);
  const loading = cur('loading', loadingProp);
  const range = rangeOf(view, date, { firstDay, agendaDays });
  const rangeKey = `${view}|${dayKey(range.start)}|${dayKey(range.end)}`;
  const monthSize = useSize(monthRef, view);

  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState(null); // { ev, x, y }
  const [moreDay, setMoreDay] = useState(null); // { day, x, y }
  const [editor, setEditor] = useState(null); // { mode, id, recurring, draft }
  const [miniMonth, setMiniMonth] = useState(startOfMonth(date));
  const [now, setNow] = useState(null); // set after mount (no server / client mismatch)
  const dragRef = useRef(null);
  const [dragView, setDragView] = useState(null);

  // ---------------------------------------------------------------- formatting
  const fmt = useMemo(() => {
    const f = (options) => new Intl.DateTimeFormat(locale, options);
    return {
      time: f({ hour: 'numeric', minute: '2-digit', hour12 }),
      hour: f({ hour: 'numeric', hour12 }),
      weekdayShort: f({ weekday: 'short' }),
      weekdayNarrow: f({ weekday: 'narrow' }),
      monthYear: f({ month: 'long', year: 'numeric' }),
      monthShortDay: f({ month: 'short', day: 'numeric' }),
      shortDate: f({ month: 'short', day: 'numeric', year: 'numeric' }),
      full: f({ weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      dayLong: f({ weekday: 'long', month: 'long', day: 'numeric' }),
    };
  }, [locale, hour12]);
  const timeLabel = (d) => (d.getMinutes() ? fmt.time : fmt.hour).format(d);
  const rangeText = (a, b) => (fmt.shortDate.formatRange ? fmt.shortDate.formatRange(a, b) : `${fmt.shortDate.format(a)} – ${fmt.shortDate.format(b)}`);
  const whenText = (ev) => {
    const lastDay = addDays(ev._end, -1);
    if (ev.allDay) return sameDay(ev._start, lastDay) ? fmt.dayLong.format(ev._start) : rangeText(ev._start, lastDay);
    if (sameDay(ev._start, addMinutes(ev._end, -1))) return `${fmt.dayLong.format(ev._start)} · ${timeLabel(ev._start)} – ${timeLabel(ev._end)}`;
    return `${fmt.monthShortDay.format(ev._start)}, ${timeLabel(ev._start)} – ${fmt.monthShortDay.format(ev._end)}, ${timeLabel(ev._end)}`;
  };

  // ---------------------------------------------------------------- calendars / events
  const calMap = useMemo(() => Object.fromEntries(calendars.map((c, i) => [String(c.id), { ...c, color: c.color || CHART_COLORS[i % 8] }])), [calendars]);
  const colorOf = (ev) => ev.color || calMap[String(ev.calendar)]?.color || CHART_COLORS[0];

  const normalized = useMemo(() => rawEvents.map(normalizeEvent), [rawEvents]);
  const q = query.trim().toLowerCase();
  const filtered = normalized.filter((ev) => !(ev.calendar != null && hiddenCalendars.includes(String(ev.calendar)))
    && (!q || [ev.title, ev.location, ev.description].some((v) => String(v ?? '').toLowerCase().includes(q))));
  const occurrences = expandEvents(filtered, range.start, range.end);

  const canEdit = (ev) => editable && ev.editable !== false && !ev.recurringId;

  // The dragged event drawn at its new position
  const shifted = (ev) => {
    if (!dragView || dragView.id !== ev.id || !dragView.moved) return ev;
    if (dragView.kind === 'move') {
      return { ...ev, _start: addMinutes(addDays(ev._start, dragView.dayDelta), dragView.minDelta), _end: addMinutes(addDays(ev._end, dragView.dayDelta), dragView.minDelta), _ghost: true };
    }
    if (dragView.kind === 'resize') {
      const end = addMinutes(ev._end, dragView.minDelta);
      const min = addMinutes(ev._start, snapMinutes);
      return { ...ev, _end: end > min ? end : min, _ghost: true };
    }
    return ev;
  };
  const shown = occurrences.map(shifted);
  const byId = (id) => occurrences.find((ev) => ev.id === id);

  // ---------------------------------------------------------------- navigation
  const fireRange = useRef(onRangeChange);
  fireRange.current = onRangeChange;
  useEffect(() => {
    fireRange.current?.({ calendar: nodeId, view, date: dayKey(date), start: dayKey(range.start), end: dayKey(range.end) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => { setMiniMonth(startOfMonth(date)); }, [dayKey(date)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Day / week: start scrolled to the working morning
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, ((scrollToHour - dayStartHour) * hourHeight) - 8);
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  // Day headers / all-day row line up with the scrolling time grid (minus its scrollbar)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && rootRef.current) rootRef.current.style.setProperty('--rc-scrollbar', `${el.offsetWidth - el.clientWidth}px`);
  });

  // Popovers close on a click anywhere outside them
  useEffect(() => {
    if (!detail && !moreDay) return undefined;
    const close = (e) => {
      if (e.target.closest?.('.rc-pop, .modal')) return;
      setDetail(null);
      setMoreDay(null);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [detail, moreDay]);

  const goto = (d) => { setDetail(null); setMoreDay(null); setProps({ date: dayKey(d) }); };
  const changeView = (next, d) => {
    setDetail(null);
    setMoreDay(null);
    setProps({ view: next, ...(d && { date: dayKey(d) }) });
    if (next !== view) onViewChange?.({ calendar: nodeId, view: next, previousView: view });
  };
  const openDay = (d) => (views.includes('day') ? changeView('day', d) : goto(d));

  // ---------------------------------------------------------------- changes
  const rawIndex = (id) => rawEvents.findIndex((raw, i) => String(raw.id ?? `e${i}`) === String(id));
  const writeEvents = (list) => { if (autoUpdate) setProps({ events: list }); };

  const commitTimes = (ev, start, end, change) => {
    const previous = publicEvent(ev);
    const next = publicEvent({ ...ev, _start: start, _end: end });
    const index = rawIndex(ev.id);
    if (index >= 0) writeEvents(rawEvents.map((raw, i) => (i === index ? { ...raw, start: next.start, end: next.end } : raw)));
    onEventUpdate?.({ calendar: nodeId, event: next, previous, change });
  };

  const showDetail = (ev, x, y) => {
    const rect = rootRef.current?.getBoundingClientRect() || { left: 0, top: 0 };
    setMoreDay(null);
    setDetail({ ev, x: x - rect.left, y: y - rect.top });
    onEventClick?.({ calendar: nodeId, event: publicEvent(ev) });
  };

  const firstCalendar = calendars.find((c) => !hiddenCalendars.includes(String(c.id)))?.id ?? calendars[0]?.id;
  const draftFrom = (start, end, allDay, extra = {}) => ({
    title: '', location: '', description: '', calendar: firstCalendar ?? '', ...extra,
    allDay,
    startDate: dayKey(start), startTime: toLocalString(start).slice(11) || '09:00',
    endDate: dayKey(allDay ? addDays(end, -1) : end), endTime: toLocalString(end).slice(11) || '10:00',
  });
  const openCreate = (start, end, allDay) => {
    if (!editable || !eventEditor) return;
    setDetail(null);
    setEditor({ mode: 'create', draft: draftFrom(start, end, allDay) });
  };
  const openEdit = (ev) => {
    const series = ev.recurringId ? normalized.find((e) => e.id === ev.recurringId) : ev;
    if (!series) return;
    setDetail(null);
    setEditor({
      mode: 'edit', id: series.id, recurring: Boolean(series.recurrence),
      draft: draftFrom(series._start, series._end, series.allDay, {
        title: series.title ?? '', location: series.location ?? '', description: series.description ?? '', calendar: series.calendar ?? '',
      }),
    });
  };
  // scope "one" removes a single occurrence of a repeating event (added to its recurrence.exceptions)
  const deleteEvent = (ev, scope = 'all') => {
    const id = ev.recurringId ?? ev.id;
    const index = rawIndex(id);
    const raw = index >= 0 ? rawEvents[index] : publicEvent(ev);
    if (scope === 'one' && ev.occurrence && index >= 0) {
      const recurrence = { ...raw.recurrence, exceptions: [...(raw.recurrence.exceptions || []), ev.occurrence] };
      writeEvents(rawEvents.map((e, i) => (i === index ? { ...raw, recurrence } : e)));
      onEventDelete?.({ calendar: nodeId, event: publicEvent(ev), occurrence: ev.occurrence, series: raw, scope });
    } else {
      writeEvents(rawEvents.filter((_, i) => i !== index));
      onEventDelete?.({ calendar: nodeId, event: raw, scope: 'all' });
    }
    setDetail(null);
    setEditor(null);
  };
  const saveEditor = () => {
    const { draft, mode, id, recurring } = editor;
    let start = draft.allDay ? draft.startDate : `${draft.startDate}T${draft.startTime || '00:00'}`;
    let end = draft.allDay ? draft.endDate : `${draft.endDate}T${draft.endTime || '00:00'}`;
    if (parseDate(end) < parseDate(start)) end = draft.allDay ? start : toLocalString(addMinutes(parseDate(start), defaultDuration));
    const fields = Object.fromEntries(Object.entries({
      title: draft.title.trim() || t('calendar.noTitle'), allDay: draft.allDay, calendar: draft.calendar,
      location: draft.location.trim(), description: draft.description.trim(),
    }).filter(([, v]) => v !== '' && v !== undefined));
    if (mode === 'create') {
      const event = { id: `n${Date.now().toString(36)}`, ...fields, start, end };
      writeEvents([...rawEvents, event]);
      onEventCreate?.({ calendar: nodeId, event });
    } else {
      const index = rawIndex(id);
      const previous = rawEvents[index];
      if (recurring) { start = previous.start; end = previous.end; } // a series keeps its schedule
      const event = { ...previous, ...fields, start, end };
      ['location', 'description'].forEach((key) => { if (!(key in fields)) delete event[key]; });
      writeEvents(rawEvents.map((raw, i) => (i === index ? event : raw)));
      onEventUpdate?.({ calendar: nodeId, event, previous, change: 'edit' });
    }
    setEditor(null);
  };

  const toggleCalendar = (calId) => {
    const key = String(calId);
    const hidden = !hiddenCalendars.includes(key);
    setProps({ hiddenCalendars: hidden ? [...hiddenCalendars, key] : hiddenCalendars.filter((k) => k !== key) });
    onCalendarToggle?.({ calendar: nodeId, calendarId: calId, hidden });
  };

  // ---------------------------------------------------------------- pointer: drag to move / resize / select
  const startMin = dayStartHour * 60;
  const endMin = dayEndHour * 60;
  const gridHeight = ((endMin - startMin) / 60) * hourHeight;
  const minuteToY = (m) => ((m - startMin) / 60) * hourHeight;

  const begin = (e, info) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { ...info, x: e.clientX, y: e.clientY, moved: false };
  };
  const updateDrag = (e, compute) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) < 4 && Math.abs(e.clientY - drag.y) < 4) return;
    drag.moved = true;
    const next = compute(drag);
    drag.view = next;
    setDragView(next);
  };
  const finish = () => { dragRef.current = null; setDragView(null); };

  // Time grid (day / week): columns = days
  const gridPoint = (e, days) => {
    const rect = colsRef.current.getBoundingClientRect();
    const col = Math.max(0, Math.min(days.length - 1, Math.floor(((e.clientX - rect.left) / rect.width) * days.length)));
    const minute = Math.max(startMin, Math.min(endMin, startMin + ((e.clientY - rect.top) / hourHeight) * 60));
    return { col, minute };
  };
  const gridHandlers = (days) => ({
    onPointerDown: (e) => {
      const evEl = e.target.closest('[data-event]');
      const pt = gridPoint(e, days);
      if (evEl) {
        const ev = byId(evEl.dataset.event);
        if (!ev) return;
        const kind = canEdit(ev) ? (e.target.closest('[data-resize]') ? 'resize' : 'move') : 'click';
        begin(e, { kind, ev, pt });
      } else {
        begin(e, { kind: 'select', pt });
      }
    },
    onPointerMove: (e) => updateDrag(e, (drag) => {
      if (drag.kind === 'click') return null;
      const pt = gridPoint(e, days);
      if (drag.kind === 'select') {
        if (!selectable) return null;
        const a = Math.floor(drag.pt.minute / slotMinutes) * slotMinutes;
        const b = Math.floor(pt.minute / slotMinutes) * slotMinutes;
        return { kind: 'select-time', day: days[drag.pt.col], from: Math.min(a, b), to: Math.min(endMin, Math.max(a, b) + slotMinutes), moved: true };
      }
      return {
        kind: drag.kind, id: drag.ev.id, moved: true,
        dayDelta: drag.kind === 'move' ? diffDays(days[drag.pt.col], days[pt.col]) : 0,
        minDelta: Math.round((pt.minute - drag.pt.minute) / snapMinutes) * snapMinutes,
      };
    }),
    onPointerUp: (e) => {
      const drag = dragRef.current;
      finish();
      if (!drag) return;
      if (drag.ev && (!drag.moved || drag.kind === 'click')) { showDetail(drag.ev, e.clientX, e.clientY); return; }
      if (drag.kind === 'select') {
        const day = days[drag.pt.col];
        if (!drag.moved || !drag.view) {
          const start = addMinutes(day, Math.floor(drag.pt.minute / slotMinutes) * slotMinutes);
          const end = addMinutes(start, defaultDuration);
          onSlotClick?.({ calendar: nodeId, start: toLocalString(start), end: toLocalString(end), allDay: false });
          openCreate(start, end, false);
        } else {
          const start = addMinutes(drag.view.day, drag.view.from);
          const end = addMinutes(drag.view.day, drag.view.to);
          onSelect?.({ calendar: nodeId, start: toLocalString(start), end: toLocalString(end), allDay: false });
          openCreate(start, end, false);
        }
        return;
      }
      const v = drag.view;
      if (!v) return;
      if (drag.kind === 'move' && (v.dayDelta || v.minDelta)) {
        commitTimes(drag.ev, addMinutes(addDays(drag.ev._start, v.dayDelta), v.minDelta), addMinutes(addDays(drag.ev._end, v.dayDelta), v.minDelta), 'move');
      } else if (drag.kind === 'resize' && v.minDelta) {
        const end = addMinutes(drag.ev._end, v.minDelta);
        const min = addMinutes(drag.ev._start, snapMinutes);
        commitTimes(drag.ev, drag.ev._start, end > min ? end : min, 'resize');
      }
    },
    onPointerCancel: finish,
  });

  // Day cells (month, all-day row): the day under the pointer
  const dayAt = (e) => {
    const el = typeof document !== 'undefined' ? document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-day]') : null;
    return el && rootRef.current?.contains(el) ? parseDate(el.dataset.day) : null;
  };
  const dayHandlers = {
    onPointerDown: (e) => {
      if (e.target.closest('[data-goto], [data-more]')) return;
      const evEl = e.target.closest('[data-event]');
      const day = dayAt(e);
      if (evEl) {
        const ev = byId(evEl.dataset.event);
        if (!ev) return;
        begin(e, { kind: canEdit(ev) ? 'move' : 'click', ev, day: day || ev._start });
      } else if (day) {
        begin(e, { kind: 'select', day });
      }
    },
    onPointerMove: (e) => updateDrag(e, (drag) => {
      if (drag.kind === 'click') return null;
      const day = dayAt(e) || drag.view?.to || drag.day;
      if (drag.kind === 'select') return selectable ? { kind: 'select-days', from: drag.day, to: day, moved: true } : null;
      return { kind: 'move', id: drag.ev.id, dayDelta: diffDays(drag.day, day), minDelta: 0, moved: true, to: day };
    }),
    onPointerUp: (e) => {
      const drag = dragRef.current;
      finish();
      if (!drag) return;
      if (drag.ev && (!drag.moved || drag.kind === 'click')) { showDetail(drag.ev, e.clientX, e.clientY); return; }
      if (drag.kind === 'select') {
        const a = drag.view && drag.moved ? (drag.view.from < drag.view.to ? drag.view.from : drag.view.to) : drag.day;
        const b = drag.view && drag.moved ? (drag.view.from < drag.view.to ? drag.view.to : drag.view.from) : drag.day;
        const payload = { calendar: nodeId, start: dayKey(a), end: dayKey(b), allDay: true };
        if (drag.moved && drag.view) onSelect?.(payload); else onSlotClick?.(payload);
        openCreate(a, addDays(b, 1), true);
        return;
      }
      if (drag.view?.dayDelta) commitTimes(drag.ev, addDays(drag.ev._start, drag.view.dayDelta), addDays(drag.ev._end, drag.view.dayDelta), 'move');
    },
    onPointerCancel: finish,
  };
  const selectedDay = (d) => dragView?.kind === 'select-days'
    && d >= (dragView.from < dragView.to ? dragView.from : dragView.to)
    && d <= (dragView.from < dragView.to ? dragView.to : dragView.from);

  // ---------------------------------------------------------------- pieces
  const eventKeyDown = (ev) => (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const rect = e.currentTarget.getBoundingClientRect();
      showDetail(ev, rect.left + 8, rect.bottom);
    }
  };

  // One row of days with spanning events (month week, or the all-day row above the time grid)
  const renderDayRow = (days, rowEvents, { maxLanes, month, dateNumbers, rowKey }) => {
    const { segs } = rowSegments(days, rowEvents);
    const cols = days.length;
    const overflow = days.map((_, c) => segs.filter((s) => s.start <= c && s.end >= c && s.lane >= maxLanes).length);
    const anyOverflow = overflow.some(Boolean);
    const lanesShown = anyOverflow ? Math.max(0, maxLanes - 1) : maxLanes;
    const top = dateNumbers ? DATE_ROW : 2;
    return (
      <div className="rc-week" key={rowKey} style={!month ? { height: top + Math.min(maxLanes, Math.max(1, segs.reduce((n, s) => Math.max(n, s.lane + 1), 0))) * LANE + 4 } : undefined}>
        <div className="rc-week-bg" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {days.map((d) => (
            <div key={dayKey(d)} data-day={dayKey(d)}
              className={['rc-cell', month && d.getMonth() !== date.getMonth() && 'rc-out', sameDay(d, today) && 'rc-today', selectedDay(d) && 'rc-sel'].filter(Boolean).join(' ')}>
              {dateNumbers && (
                <button type="button" className="rc-daynum" data-goto aria-label={fmt.full.format(d)} onClick={() => openDay(d)}>
                  {d.getDate() === 1 ? fmt.monthShortDay.format(d) : d.getDate()}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="rc-week-events">
          {segs.filter((s) => s.lane < lanesShown).map((s) => {
            const { ev } = s;
            const color = colorOf(ev);
            const bar = ev.allDay || s.end > s.start || s.contLeft || s.contRight;
            return (
              <div key={`${ev.id}-${s.start}`} data-event={ev.id} role="button" tabIndex={0} onKeyDown={eventKeyDown(ev)}
                title={`${ev.title ?? ''} · ${whenText(ev)}`}
                className={['rc-ev', bar ? 'rc-ev-bar' : 'rc-ev-dot', s.contLeft && 'rc-cont-l', s.contRight && 'rc-cont-r', ev._ghost && 'rc-ghost'].filter(Boolean).join(' ')}
                style={{
                  left: `calc(${(s.start / cols) * 100}% + 2px)`, width: `calc(${((s.end - s.start + 1) / cols) * 100}% - 4px)`, top: top + s.lane * LANE,
                  ...(bar ? { background: color, color: inkOn(color) } : { display: 'flex', alignItems: 'center' }),
                }}>
                {!bar && <span className="rc-dot" style={{ background: color }} />}
                {!ev.allDay && !s.contLeft && <span className="rc-time">{timeLabel(ev._start)}</span>}
                {ev.title || t('calendar.noTitle')}
              </div>
            );
          })}
          {overflow.map((n, c) => (n > 0 || (anyOverflow && segs.some((s) => s.lane >= lanesShown && s.start <= c && s.end >= c))) && (
            <button key={`more${c}`} type="button" className="rc-more" data-more
              style={{ left: `calc(${(c / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)`, top: top + lanesShown * LANE }}
              onClick={(e) => {
                const rect = rootRef.current.getBoundingClientRect();
                setDetail(null);
                setMoreDay({ day: days[c], x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}>
              {t('calendar.more', { count: segs.filter((s) => s.lane >= lanesShown && s.start <= c && s.end >= c).length })}
            </button>
          ))}
        </div>
      </div>
    );
  };

  // ================================================================ views
  let body = null;

  if (view === 'month') {
    const weeks = Math.round(diffDays(range.start, range.end) / 7);
    const rowHeight = (monthSize.height || (height - 90)) / weeks;
    const maxLanes = Math.max(1, Math.floor((rowHeight - DATE_ROW - 2) / LANE));
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
    body = (
      <>
        <div className="rc-wd-head" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {weekDays.map((d) => <div key={d.getDay()}>{fmt.weekdayShort.format(d)}</div>)}
        </div>
        <div ref={monthRef} className={`rc-month ${dragView ? 'rc-dragging' : ''}`} {...dayHandlers}>
          {Array.from({ length: weeks }, (_, w) => {
            const days = Array.from({ length: 7 }, (_, i) => addDays(range.start, w * 7 + i));
            return renderDayRow(days, shown, { maxLanes, month: true, dateNumbers: true, rowKey: dayKey(days[0]) });
          })}
        </div>
      </>
    );
  }

  if (view === 'day' || view === 'week') {
    const allDays = view === 'day' ? [range.start] : Array.from({ length: 7 }, (_, i) => addDays(range.start, i));
    const days = view === 'week' && !weekends ? allDays.filter((d) => d.getDay() !== 0 && d.getDay() !== 6) : allDays;
    const isBanner = (ev) => ev.allDay || ev._end - ev._start >= 864e5;
    const bannerEvents = shown.filter(isBanner);
    const timed = shown.filter((ev) => !isBanner(ev));
    const hours = Array.from({ length: dayEndHour - dayStartHour }, (_, i) => dayStartHour + i);
    const work = workingHours ? { start: 9, end: 17, days: [1, 2, 3, 4, 5], ...workingHours } : null;

    body = (
      <>
        <div className="rc-tg-head" style={{ paddingRight: 'var(--rc-scrollbar, 0px)' }}>
          <div className="rc-gutter" />
          {days.map((d) => (
            <button key={dayKey(d)} type="button" className={`rc-dayhead ${sameDay(d, today) ? 'rc-today' : ''}`}
              onClick={() => openDay(d)} aria-label={fmt.full.format(d)}>
              <div className="rc-wd">{fmt.weekdayShort.format(d)}</div>
              <div className="rc-dn">{d.getDate()}</div>
            </button>
          ))}
        </div>
        <div className={`rc-allday ${dragView ? 'rc-dragging' : ''}`} style={{ paddingRight: 'var(--rc-scrollbar, 0px)' }} {...dayHandlers}>
          <div className="rc-gutter rc-allday-label">{t('calendar.allDay')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {renderDayRow(days, bannerEvents, { maxLanes: 3, month: false, dateNumbers: false, rowKey: 'allday' })}
          </div>
        </div>
        <div ref={scrollRef} className="rc-tg-scroll">
          <div className="rc-tg" style={{ height: gridHeight }}>
            <div className="rc-hours">
              {hours.map((h) => h > dayStartHour && (
                <span key={h} style={{ top: minuteToY(h * 60) }}>{fmt.hour.format(new Date(2000, 0, 1, h))}</span>
              ))}
            </div>
            <div ref={colsRef} className={`rc-cols ${dragView ? 'rc-dragging' : ''}`} {...gridHandlers(days)}>
              {hours.map((h) => (
                <div key={`h${h}`}>
                  <div className="rc-hline" style={{ top: minuteToY(h * 60) }} />
                  {slotMinutes < 60 && <div className="rc-hline rc-half" style={{ top: minuteToY(h * 60 + 30) }} />}
                </div>
              ))}
              {days.map((d) => {
                const dayEnd = addDays(d, 1);
                const items = layoutDay(timed.filter((ev) => ev._start < dayEnd && ev._end > d).map((ev) => {
                  const s = ev._start <= d ? 0 : minutesOfDay(ev._start);
                  const e = ev._end >= dayEnd ? 1440 : minutesOfDay(ev._end);
                  return { ev, s: Math.max(s, startMin), e: Math.min(e, endMin), cutTop: ev._start < d, cutBottom: ev._end > dayEnd };
                }).filter((it) => it.e > it.s));
                const off = [];
                if (work) {
                  if (!work.days.includes(d.getDay())) off.push([startMin, endMin]);
                  else {
                    if (work.start * 60 > startMin) off.push([startMin, work.start * 60]);
                    if (work.end * 60 < endMin) off.push([work.end * 60, endMin]);
                  }
                }
                return (
                  <div key={dayKey(d)} className="rc-col">
                    {off.map(([a, b]) => <div key={a} className="rc-off" style={{ top: minuteToY(a), height: minuteToY(b) - minuteToY(a) }} />)}
                    {items.map(({ ev, s, e, col, cols, cutTop, cutBottom }) => {
                      const color = colorOf(ev);
                      const top = minuteToY(s);
                      const h = Math.max(18, minuteToY(e) - top - 1);
                      return (
                        <div key={ev.id} data-event={ev.id} role="button" tabIndex={0} onKeyDown={eventKeyDown(ev)}
                          title={`${ev.title ?? ''} · ${whenText(ev)}`}
                          className={`rc-tev ${ev._ghost ? 'rc-ghost' : ''}`}
                          style={{
                            top, height: h, left: `calc(${(col / cols) * 100}% + 1px)`, width: `calc(${100 / cols}% - 3px)`,
                            background: color, color: inkOn(color),
                            ...(cutTop && { borderTopLeftRadius: 0, borderTopRightRadius: 0 }),
                            ...(cutBottom && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }),
                          }}>
                          <div className="rc-tev-title">{ev.title || t('calendar.noTitle')}{h < 34 && <span className="fw-normal">{`, ${timeLabel(ev._start)}`}</span>}</div>
                          {h >= 34 && <div className="rc-tev-time">{`${timeLabel(ev._start)} – ${timeLabel(ev._end)}`}</div>}
                          {h >= 52 && ev.location && <div className="rc-tev-time">{ev.location}</div>}
                          {canEdit(ev) && !cutBottom && <div className="rc-resize" data-resize />}
                        </div>
                      );
                    })}
                    {dragView?.kind === 'select-time' && sameDay(dragView.day, d) && (
                      <div className="rc-selbox" style={{ top: minuteToY(dragView.from), height: minuteToY(dragView.to) - minuteToY(dragView.from) }}>
                        {`${timeLabel(addMinutes(d, dragView.from))} – ${timeLabel(addMinutes(d, dragView.to))}`}
                      </div>
                    )}
                    {nowIndicator && now && sameDay(now, d) && minutesOfDay(now) >= startMin && minutesOfDay(now) <= endMin && (
                      <div className="rc-now" style={{ top: minuteToY(minutesOfDay(now)) }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </>
    );
  }

  if (view === 'agenda') {
    const days = Array.from({ length: diffDays(range.start, range.end) }, (_, i) => addDays(range.start, i))
      .map((d) => ({ d, items: shown.filter((ev) => ev._start < addDays(d, 1) && ev._end > d).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a._start - b._start) }))
      .filter((day) => day.items.length);
    body = (
      <div className="rc-agenda">
        {days.length === 0 && <div className="text-center text-muted py-5">{t('calendar.noEvents')}</div>}
        {days.map(({ d, items }) => (
          <div key={dayKey(d)} className="rc-ag-day">
            <div className={`rc-ag-date ${sameDay(d, today) ? 'rc-today' : ''}`}>
              <button type="button" className="rc-dn border-0 p-0" data-goto onClick={() => openDay(d)}
                style={sameDay(d, today) ? { background: 'var(--bs-primary)', color: '#fff' } : { background: 'none', color: 'var(--bs-body-color)' }}>{d.getDate()}</button>
              <span className="small text-uppercase" style={{ color: 'var(--bs-secondary-color)' }}>{`${fmt.monthShortDay.format(d).replace(/\d+/, '').trim()}, ${fmt.weekdayShort.format(d)}`}</span>
            </div>
            <div className="flex-grow-1" style={{ minWidth: 0 }}>
              {items.map((ev) => (
                <div key={ev.id} className="rc-ag-item" role="button" tabIndex={0} onKeyDown={eventKeyDown(ev)}
                  onClick={(e) => showDetail(ev, e.clientX, e.clientY)}>
                  <span className="rc-dot" style={{ background: colorOf(ev) }} />
                  <span style={{ width: 150, flex: 'none', color: 'var(--bs-secondary-color)' }}>
                    {ev.allDay ? t('calendar.allDay') : `${timeLabel(ev._start)} – ${timeLabel(ev._end)}`}
                  </span>
                  <span className="text-truncate">
                    <span className="fw-semibold">{ev.title || t('calendar.noTitle')}</span>
                    {ev.location && <span style={{ color: 'var(--bs-secondary-color)' }}>{` · ${ev.location}`}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (view === 'year') {
    const marks = new Set();
    shown.forEach((ev) => {
      for (let d = startOfDay(ev._start); d < ev._end && d < range.end; d = addDays(d, 1)) marks.add(dayKey(d));
    });
    body = (
      <div className="rc-year">
        <div className="row g-4">
          {Array.from({ length: 12 }, (_, m) => (
            <div key={m} className="col-12 col-sm-6 col-lg-4 col-xl-3">
              <MiniMonth month={new Date(date.getFullYear(), m, 1)} today={today} firstDay={firstDay} fmt={fmt} t={t}
                marks={marks} onPick={openDay} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- toolbar / sidebar / popovers
  const title = view === 'day' ? fmt.full.format(date)
    : view === 'week' ? rangeText(range.start, addDays(range.end, -1))
      : view === 'month' ? fmt.monthYear.format(date)
        : view === 'year' ? String(date.getFullYear())
          : rangeText(range.start, addDays(range.end, -1));

  const createNow = () => {
    const base = sameDay(date, today) && now ? now : addMinutes(date, 9 * 60);
    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), base.getHours() + (sameDay(date, today) ? 1 : 0), 0);
    openCreate(start, addMinutes(start, defaultDuration), false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { setDetail(null); setMoreDay(null); return; }
    if (!keyboardShortcuts || editor || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable=true]')) return;
    const viewKeys = { d: 'day', w: 'week', m: 'month', y: 'year', a: 'agenda' };
    const key = e.key.toLowerCase();
    if (key === 't') goto(today);
    else if (key === 'j' || key === 'n') goto(shiftDate(view, date, 1, { agendaDays }));
    else if (key === 'k' || key === 'p') goto(shiftDate(view, date, -1, { agendaDays }));
    else if (key === 'c' && editable && eventEditor) createNow();
    else if (viewKeys[key] && views.includes(viewKeys[key])) changeView(viewKeys[key]);
    else return;
    e.preventDefault();
  };

  const popStyle = (pos) => {
    const width = rootRef.current?.clientWidth || 600;
    return { left: Math.max(8, Math.min(pos.x + 8, width - 308)), top: Math.max(8, pos.y + 8) };
  };

  const detailView = detail && (() => {
    const { ev } = detail;
    const cal = calMap[String(ev.calendar)];
    return (
      <div className="rc-pop" style={popStyle(detail)} role="dialog" aria-label={ev.title || t('calendar.noTitle')}>
        <div className="d-flex justify-content-end gap-1 mb-1">
          {editable && eventEditor && ev.editable !== false && (
            <button type="button" className="rc-iconbtn" title={t('calendar.edit')} aria-label={t('calendar.edit')} onClick={() => openEdit(ev)}>✎</button>
          )}
          {editable && ev.editable !== false && (
            <button type="button" className="rc-iconbtn" title={t('calendar.delete')} aria-label={t('calendar.delete')}
              onClick={() => (ev.recurringId ? setDetail({ ...detail, confirmDelete: true }) : deleteEvent(ev))}>🗑</button>
          )}
          <button type="button" className="rc-iconbtn" aria-label={t('common.close')} onClick={() => setDetail(null)}>×</button>
        </div>
        <div className="d-flex gap-2">
          <span className="rc-swatch" style={{ background: colorOf(ev) }} />
          <div style={{ minWidth: 0 }}>
            <div className="fw-semibold fs-6 text-break">{ev.title || t('calendar.noTitle')}</div>
            <div className="small" style={{ color: 'var(--bs-secondary-color)' }}>{whenText(ev)}</div>
            {ev.recurrence && <div className="small" style={{ color: 'var(--bs-secondary-color)' }}>{t(`calendar.repeat.${ev.recurrence.freq || 'weekly'}`)}</div>}
            {ev.location && <div className="small mt-2">📍 {ev.location}</div>}
            {ev.description && <div className="small mt-2" style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</div>}
            {cal && <div className="small mt-2 d-flex align-items-center"><span className="rc-dot" style={{ background: cal.color }} />{cal.name ?? cal.id}</div>}
          </div>
        </div>
        {detail.confirmDelete && (
          <div className="border-top mt-3 pt-2">
            <div className="small fw-semibold mb-2">{t('calendar.deleteRecurring')}</div>
            <div className="d-flex flex-wrap gap-2">
              <Button size="sm" variant="outline-danger" onClick={() => deleteEvent(ev, 'one')}>{t('calendar.thisEvent')}</Button>
              <Button size="sm" variant="danger" onClick={() => deleteEvent(ev, 'all')}>{t('calendar.allEvents')}</Button>
            </div>
          </div>
        )}
      </div>
    );
  })();

  const moreView = moreDay && (
    <div className="rc-pop" style={popStyle(moreDay)} role="dialog" aria-label={fmt.full.format(moreDay.day)}>
      <div className="d-flex align-items-center mb-2">
        <button type="button" className="btn btn-link p-0 text-decoration-none fw-semibold flex-grow-1 text-start" onClick={() => openDay(moreDay.day)}>
          {fmt.dayLong.format(moreDay.day)}
        </button>
        <button type="button" className="rc-iconbtn" aria-label={t('common.close')} onClick={() => setMoreDay(null)}>×</button>
      </div>
      {shown.filter((ev) => ev._start < addDays(moreDay.day, 1) && ev._end > moreDay.day)
        .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a._start - b._start)
        .map((ev) => {
          const color = colorOf(ev);
          return (
            <div key={ev.id} role="button" tabIndex={0} className="rounded px-2 mb-1 small text-truncate"
              style={ev.allDay ? { background: color, color: inkOn(color), cursor: 'pointer' } : { cursor: 'pointer' }}
              onKeyDown={eventKeyDown(ev)} onClick={(e) => showDetail(ev, e.clientX, e.clientY)}>
              {!ev.allDay && <span className="rc-dot" style={{ background: color }} />}
              {!ev.allDay && <span className="me-1" style={{ color: 'var(--bs-secondary-color)' }}>{timeLabel(ev._start)}</span>}
              {ev.title || t('calendar.noTitle')}
            </div>
          );
        })}
    </div>
  );

  const setDraft = (patch) => setEditor((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  const editorView = editor && (
    <Modal show onHide={() => setEditor(null)} centered>
      <Form onSubmit={(e) => { e.preventDefault(); saveEditor(); }}>
        <Modal.Header closeButton>
          <Modal.Title as="h6">{editor.mode === 'create' ? t('calendar.newEvent') : t('calendar.editEvent')}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Control autoFocus size="lg" className="mb-3" placeholder={t('calendar.titlePlaceholder')} aria-label={t('calendar.title')}
            value={editor.draft.title} onChange={(e) => setDraft({ title: e.target.value })} />
          <Form.Check type="switch" id={`${nodeId}-allday`} className="mb-2" label={t('calendar.allDay')} disabled={editor.recurring}
            checked={editor.draft.allDay} onChange={(e) => setDraft({ allDay: e.target.checked })} />
          <div className="row g-2 mb-3">
            <div className="col-6">
              <Form.Label className="small mb-1">{t('calendar.start')}</Form.Label>
              <Form.Control type="date" size="sm" disabled={editor.recurring} value={editor.draft.startDate}
                onChange={(e) => setDraft({ startDate: e.target.value, ...(e.target.value > editor.draft.endDate && { endDate: e.target.value }) })} />
              {!editor.draft.allDay && (
                <Form.Control type="time" size="sm" className="mt-1" disabled={editor.recurring} aria-label={t('calendar.startTime')}
                  value={editor.draft.startTime} onChange={(e) => setDraft({ startTime: e.target.value })} />
              )}
            </div>
            <div className="col-6">
              <Form.Label className="small mb-1">{t('calendar.end')}</Form.Label>
              <Form.Control type="date" size="sm" disabled={editor.recurring} value={editor.draft.endDate}
                onChange={(e) => setDraft({ endDate: e.target.value })} />
              {!editor.draft.allDay && (
                <Form.Control type="time" size="sm" className="mt-1" disabled={editor.recurring} aria-label={t('calendar.endTime')}
                  value={editor.draft.endTime} onChange={(e) => setDraft({ endTime: e.target.value })} />
              )}
            </div>
          </div>
          {editor.recurring && <div className="small text-muted mb-2">{t('calendar.seriesNote')}</div>}
          {calendars.length > 0 && (
            <Form.Group className="mb-2">
              <Form.Label className="small mb-1">{t('calendar.calendar')}</Form.Label>
              <Form.Select size="sm" value={editor.draft.calendar} onChange={(e) => setDraft({ calendar: e.target.value })}>
                {calendars.map((c) => <option key={c.id} value={c.id}>{c.name ?? c.id}</option>)}
              </Form.Select>
            </Form.Group>
          )}
          <Form.Group className="mb-2">
            <Form.Label className="small mb-1">{t('calendar.location')}</Form.Label>
            <Form.Control size="sm" value={editor.draft.location} onChange={(e) => setDraft({ location: e.target.value })} />
          </Form.Group>
          <Form.Group>
            <Form.Label className="small mb-1">{t('calendar.description')}</Form.Label>
            <Form.Control as="textarea" rows={3} size="sm" value={editor.draft.description} onChange={(e) => setDraft({ description: e.target.value })} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          {editor.mode === 'edit' && (
            <Button variant="outline-danger" className="me-auto" onClick={() => deleteEvent(byId(editor.id) || normalized.find((ev) => ev.id === editor.id))}>
              {t('calendar.delete')}
            </Button>
          )}
          <Button variant="outline-secondary" onClick={() => setEditor(null)}>{t('calendar.cancel')}</Button>
          <Button type="submit" variant="primary">{t('calendar.save')}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );

  const sidebarView = sidebar && (
    <div className="rc-side d-none d-lg-block">
      {editable && eventEditor && (
        <Button variant="primary" className="mb-3 px-4 rounded-pill shadow-sm" onClick={createNow}>{`+ ${t('calendar.create')}`}</Button>
      )}
      <MiniMonth month={miniMonth} selected={date} today={today} firstDay={firstDay} fmt={fmt} t={t}
        onNav={(step) => setMiniMonth((m) => new Date(m.getFullYear(), m.getMonth() + step, 1))} onPick={goto} />
      {calendars.length > 0 && (
        <div className="mt-3">
          <div className="small fw-semibold mb-1">{t('calendar.myCalendars')}</div>
          {calendars.map((c) => {
            const color = calMap[String(c.id)].color;
            const on = !hiddenCalendars.includes(String(c.id));
            return (
              <label key={c.id} className="d-flex align-items-center gap-2 py-1 small" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={on} onChange={() => toggleCalendar(c.id)} style={{ accentColor: color, width: 16, height: 16 }} />
                <span className="text-truncate">{c.name ?? c.id}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );

  const toolbar = (
    <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
      <Button size="sm" variant="outline-secondary" className="rounded-pill px-3" onClick={() => goto(today)} title="T">{t('calendar.today')}</Button>
      <div className="d-flex">
        <button type="button" className="rc-iconbtn" aria-label={t('calendar.previous')} onClick={() => goto(shiftDate(view, date, -1, { agendaDays }))}>‹</button>
        <button type="button" className="rc-iconbtn" aria-label={t('calendar.next')} onClick={() => goto(shiftDate(view, date, 1, { agendaDays }))}>›</button>
      </div>
      <h2 className="rc-title" aria-live="polite">{title}</h2>
      {loading && <Spinner animation="border" size="sm" role="status"><span className="visually-hidden">{t('common.loading')}</span></Spinner>}
      <div className="ms-auto d-flex flex-wrap gap-2 align-items-center">
        {searchable && (
          <Form.Control size="sm" type="search" placeholder={t('calendar.search')} aria-label={t('calendar.search')} style={{ width: 180 }}
            value={query} onChange={(e) => setQuery(e.target.value)} />
        )}
        {views.length > 1 && (
          <ButtonGroup size="sm" aria-label={t('calendar.view')}>
            {views.map((v) => (
              <Button key={v} variant={v === view ? 'primary' : 'outline-secondary'} aria-pressed={v === view} onClick={() => changeView(v)}>
                {t(`calendar.views.${v}`)}
              </Button>
            ))}
          </ButtonGroup>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} data-rcube-calendar={nodeId} className={`rcube-cal mb-3 ${loading ? 'rc-loading' : ''} ${className}`.trim()}
      style={style} onKeyDown={onKeyDown}>
      <style>{CAL_CSS}</style>
      {sidebarView}
      <div className="rc-main" style={{ height }}>
        {toolbar}
        <div className="rc-body" aria-busy={loading || undefined}>{body}</div>
      </div>
      {detailView}
      {moreView}
      {editorView}
    </div>
  );
};
