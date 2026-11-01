// Pure helpers for Calendar, shared by the component (calendar.js) and the form actions (form.js)

export const CALENDAR_VIEWS = ['day', 'week', 'month', 'year', 'agenda'];

const pad = (n) => String(n).padStart(2, '0');

// "YYYY-MM-DD" of a local date
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
// "YYYY-MM-DDTHH:mm" (local), or "YYYY-MM-DD" for all-day values
export const toLocalString = (d, allDay = false) => (allDay ? dayKey(d) : `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`);

// "YYYY-MM-DD" is a local date (new Date("YYYY-MM-DD") would be UTC midnight)
export const parseDate = (value) => {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number') return new Date(value);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(value);
};
export const isDateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds());
export const addMinutes = (d, n) => new Date(d.getTime() + n * 60000);
export const addMonths = (d, n) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1, d.getHours(), d.getMinutes());
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return target;
};
export const startOfWeek = (d, firstDay = 0) => addDays(startOfDay(d), -((d.getDay() - firstDay + 7) % 7));
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const diffDays = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / 864e5);
export const minutesOfDay = (d) => d.getHours() * 60 + d.getMinutes();

/**
 * Visible range of a view: { start, end } (end exclusive).
 * month covers whole weeks; agenda covers agendaDays from the date.
 */
export const rangeOf = (view, date, { firstDay = 0, agendaDays = 30 } = {}) => {
  const d = startOfDay(parseDate(date));
  switch (view) {
    case 'day': return { start: d, end: addDays(d, 1) };
    case 'month': {
      const start = startOfWeek(startOfMonth(d), firstDay);
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const weeks = Math.ceil(diffDays(start, monthEnd) / 7);
      return { start, end: addDays(start, weeks * 7) };
    }
    case 'year': return { start: new Date(d.getFullYear(), 0, 1), end: new Date(d.getFullYear() + 1, 0, 1) };
    case 'agenda': return { start: d, end: addDays(d, agendaDays) };
    case 'week':
    default: {
      const start = startOfWeek(d, firstDay);
      return { start, end: addDays(start, 7) };
    }
  }
};

// Next / previous period of a view
export const shiftDate = (view, date, step, { agendaDays = 30 } = {}) => {
  const d = parseDate(date);
  if (view === 'day') return addDays(d, step);
  if (view === 'month') return addMonths(d, step);
  if (view === 'year') return addMonths(d, 12 * step);
  if (view === 'agenda') return addDays(d, agendaDays * step);
  return addDays(d, 7 * step);
};

/**
 * Event as used internally: _start / _end Dates, end exclusive.
 * All-day events: "end" in the schema is the LAST day (inclusive); omitted = one day.
 * Timed events: omitted / invalid end = 1 hour.
 */
export const normalizeEvent = (event, index = 0) => {
  const allDay = event.allDay ?? isDateOnly(event.start);
  let start = parseDate(event.start);
  let end = event.end ? parseDate(event.end) : null;
  if (allDay) {
    start = startOfDay(start);
    end = end && end >= start ? addDays(startOfDay(end), 1) : addDays(start, 1);
  } else if (!end || Number.isNaN(end.getTime()) || end <= start) {
    end = addMinutes(start, 60);
  }
  return { ...event, id: String(event.id ?? `e${index}`), allDay, _start: start, _end: end };
};

// Event for callbacks / storage: start / end strings again, internal fields removed
export const publicEvent = (event) => {
  const { _start, _end, ...rest } = event;
  if (!_start) return rest;
  return {
    ...rest,
    start: toLocalString(_start, event.allDay),
    end: event.allDay ? dayKey(addDays(_end, -1)) : toLocalString(_end),
  };
};

/**
 * Expand events into the occurrences that overlap [rangeStart, rangeEnd).
 * recurrence: { freq: daily | weekly | monthly | yearly, interval, count, until, byDay: [0-6], exceptions: ["YYYY-MM-DD"] }
 * Occurrences get id "<id>@<YYYY-MM-DD>", recurringId and occurrence (the date).
 */
export const expandEvents = (events, rangeStart, rangeEnd) => events.flatMap((event) => {
  if (!event.recurrence) return event._start < rangeEnd && event._end > rangeStart ? [event] : [];
  const { freq = 'weekly', interval = 1, count, until, byDay, exceptions = [] } = event.recurrence;
  const step = Math.max(1, Number(interval) || 1);
  const duration = event._end - event._start;
  const untilEnd = until ? addDays(startOfDay(parseDate(until)), 1) : null;
  const skip = new Set(exceptions.map(String));
  const out = [];
  let produced = 0;
  const emit = (start) => {
    if (start < event._start) return true;
    if ((untilEnd && start >= untilEnd) || (count && produced >= count) || start >= rangeEnd) return false;
    produced += 1;
    const end = new Date(start.getTime() + duration);
    const key = dayKey(start);
    if (end > rangeStart && !skip.has(key)) {
      out.push({ ...event, id: `${event.id}@${key}`, recurringId: event.id, occurrence: key, _start: start, _end: end });
    }
    return true;
  };
  for (let i = 0; i < 5000; i += 1) {
    if (freq === 'weekly' && Array.isArray(byDay) && byDay.length) {
      const weekStart = addDays(startOfWeek(event._start, 0), 7 * step * i);
      const days = [...byDay].map(Number).sort((a, b) => a - b);
      let keepGoing = true;
      for (const day of days) {
        const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + day, event._start.getHours(), event._start.getMinutes());
        if (!emit(start)) { keepGoing = false; break; }
      }
      if (!keepGoing) break;
    } else {
      const start = freq === 'daily' ? addDays(event._start, step * i)
        : freq === 'monthly' ? addMonths(event._start, step * i)
          : freq === 'yearly' ? addMonths(event._start, 12 * step * i)
            : addDays(event._start, 7 * step * i);
      if (!emit(start)) break;
    }
  }
  return out;
});
