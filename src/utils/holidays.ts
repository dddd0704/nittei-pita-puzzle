type HolidayMap = Map<string, string>;

const holidayText = `
令和8年（2026年）

元日 1月1日
成人の日 1月12日
建国記念の日 2月11日
天皇誕生日 2月23日
春分の日 3月20日
昭和の日 4月29日
憲法記念日 5月3日
みどりの日 5月4日
こどもの日 5月5日
休日 5月6日
海の日 7月20日
山の日 8月11日
敬老の日 9月21日
休日 9月22日
秋分の日 9月23日
スポーツの日 10月12日
文化の日 11月3日
勤労感謝の日 11月23日

令和9年（2027年）

元日 1月1日
成人の日 1月11日
建国記念の日 2月11日
天皇誕生日 2月23日
春分の日 3月21日
休日 3月22日
昭和の日 4月29日
憲法記念日 5月3日
みどりの日 5月4日
こどもの日 5月5日
海の日 7月19日
山の日 8月11日
敬老の日 9月20日
秋分の日 9月23日
スポーツの日 10月11日
文化の日 11月3日
勤労感謝の日 11月23日
`;

function pad(n: number) {
    return String(n).padStart(2, "0");
}

function buildMap(): HolidayMap {

    const map = new Map<string, string>();

    let year = 0;

    const lines = holidayText
        .split(/\r?\n/)
        .map(v => v.trim())
        .filter(Boolean);

    for (const line of lines) {

        const yearMatch = line.match(/20\d\d/);

        if (yearMatch) {
            year = Number(yearMatch[0]);
            continue;
        }

        const match = line.match(/^(.+?)\s+(\d{1,2})月(\d{1,2})日$/);

        if (!match) continue;

        const [, name, month, day] = match;

        const key =
            `${year}-${pad(Number(month))}-${pad(Number(day))}`;

        map.set(key, name);
    }

    return map;
}

export const holidays = buildMap();

export function getHolidayName(
    date: string
) {
    return holidays.get(date);
}

export function isHoliday(
    date: string
) {
    return holidays.has(date);
}
export function isHolidayLike(date: string) {
    const d = new Date(date);

    const weekday = d.getDay();

    return (
        weekday === 0 ||
        weekday === 6 ||
        holidays.has(date)
    );
}