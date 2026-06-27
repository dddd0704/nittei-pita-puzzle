export type ExtractedDate = {
  date: string;
  checked: boolean;
  source: string;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function makeDate(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function parseParts(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return { y, m, d };
}

function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}

export function extractDatesFromText(
  text: string,
  startDate: string,
  endDate: string
): ExtractedDate[] {

  const start = parseParts(startDate);

  const year = start.y;
  const defaultMonth = start.m;

  const found = new Map<string, string>();

  const lines = text
    .replace(/[，、・･,]/g, " ")
    .split(/\r?\n/);

  for (const originalLine of lines) {

    let line = originalLine.replace(
      /[０-９]/g,
      s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    );

    let currentMonth = defaultMonth;

    const monthMatch = line.match(/(\d{1,2})\s*月/);

    if (monthMatch) {
      currentMonth = Number(monthMatch[1]);
    }

    //-----------------------------------
    // 7/12
    // 7月12日
    //-----------------------------------

    for (const m of line.matchAll(
      /(\d{1,2})\s*(?:月|\/)\s*(\d{1,2})\s*日?/g
    )) {

      const mm = Number(m[1]);
      const dd = Number(m[2]);

      if (
        mm < 1 ||
        mm > 12 ||
        dd < 1 ||
        dd > 31
      ) continue;

      const date = makeDate(year, mm, dd);

      if (inRange(date, startDate, endDate)) {
        found.set(date, originalLine.trim());
      }
    }

    //-----------------------------------
    // ○日
    //-----------------------------------

    for (const m of line.matchAll(/(\d{1,2})\s*日/g)) {

      const dd = Number(m[1]);

      const date = makeDate(
        year,
        currentMonth,
        dd
      );

      if (inRange(date, startDate, endDate)) {
        found.set(date, originalLine.trim());
      }
    }

    //-----------------------------------
    // 1 3 5
    //-----------------------------------

    const hasContext =
      /月|日|予定|NG|不可|無理|×|❌|✕|✖/.test(originalLine);

    if (hasContext) {

      const stripped = line
        .replace(/\d{1,2}\s*日/g, " ")
        .replace(/\d{1,2}\s*(?:月|\/)\s*\d{1,2}/g, " ");

      for (const m of stripped.matchAll(
        /(?:^|\s)(\d{1,2})(?=\s|$)/g
      )) {

        const dd = Number(m[1]);

        if (
          dd < 1 ||
          dd > 31
        ) continue;

        const date = makeDate(
          year,
          currentMonth,
          dd
        );

        if (inRange(date, startDate, endDate)) {
          found.set(date, originalLine.trim());
        }
      }
    }
  }

  return [...found.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, source]) => ({
      date,
      source,
      checked: true
    }));
}