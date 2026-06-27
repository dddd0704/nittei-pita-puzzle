export function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function makeDate(
  year: number,
  month: number,
  day: number
) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);

  return {
    y,
    m,
    d,
  };
}

export function datesBetween(
  start: string,
  end: string
) {
  if (!start || !end) return [];

  const out: string[] = [];

  const s = parseParts(start);
  const e = parseParts(end);

  let cur = new Date(
    s.y,
    s.m - 1,
    s.d
  );

  const last = new Date(
    e.y,
    e.m - 1,
    e.d
  );

  while (cur <= last) {

    out.push(
      makeDate(
        cur.getFullYear(),
        cur.getMonth() + 1,
        cur.getDate()
      )
    );

    cur.setDate(
      cur.getDate() + 1
    );
  }

  return out;
}

export function weekdayIndex(
  date: string
) {
  const p = parseParts(date);

  return new Date(
    p.y,
    p.m - 1,
    p.d
  ).getDay();
}

export function weekday(
  date: string
) {
  return [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土",
  ][weekdayIndex(date)];
}

export function isWeekend(
  date: string
) {
  const d = weekdayIndex(date);

  return d === 0 || d === 6;
}

export function displayDate(
  date: string
) {
  return date
    .slice(5)
    .replace("-", "/");
}

export function buildCalendarWeeks(
  dates: string[]
) {
  if (!dates.length) return [];

  const first = weekdayIndex(
    dates[0]
  );

  const cells: (string | null)[] = [
    ...Array(first).fill(null),
    ...dates,
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (string | null)[][] = [];

  for (
    let i = 0;
    i < cells.length;
    i += 7
  ) {
    weeks.push(
      cells.slice(i, i + 7)
    );
  }

  return weeks;
}