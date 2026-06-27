import React from "react";
import {
    buildCalendarWeeks,
    displayDate,
    weekday,
} from "../utils/dateUtils";

import {
    getHolidayName,
} from "../utils/holidays";

export type Status =
    | "ok"
    | "night"
    | "day"
    | "maybe"
    | "ng";

const statusOptions = [
    { value: "ok", label: "⭕️", summaryLabel: "⭕" },
    { value: "night", label: "🌙", summaryLabel: "🌙" },
    { value: "day", label: "🌞", summaryLabel: "🌞" },
    { value: "maybe", label: "保留", summaryLabel: "?" },
    { value: "ng", label: "❌", summaryLabel: "×" },
] as const;

type SummaryCounts = Partial<Record<Status, number>>;

function StatusButtons({
    current,
    onPick,
}: {
    current?: Status;
    onPick: (s: Status) => void;
}) {
    return (
        <div className="status-buttons">
            {statusOptions.map((o) => (
                <button
                    key={o.value}
                    className={current === o.value ? "selected" : ""}
                    onClick={() => onPick(o.value)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

function AvailabilitySummary({ counts }: { counts?: SummaryCounts }) {
    if (!counts) return null;

    const total = statusOptions.reduce((sum, option) => sum + (counts[option.value] || 0), 0);
    if (total === 0) return null;

    return (
        <div className="calendar-summary" aria-label="入力状況集計：⭕、🌙、🌞、保留、❌の順">
            <div className="calendar-summary-icons" aria-hidden="true">
                {statusOptions.map((option) => (
                    <span key={option.value} className={`calendar-summary-icon summary-${option.value}`}>
                        {option.summaryLabel}
                    </span>
                ))}
            </div>
            <div className="calendar-summary-counts">
                {statusOptions.map((option) => (
                    <span
                        key={option.value}
                        className={`calendar-summary-number summary-${option.value}`}
                        title={`${option.label}: ${counts[option.value] || 0}`}
                    >
                        {counts[option.value] || 0}
                    </span>
                ))}
            </div>
        </div>
    );
}

function dayClass(date: string) {
    const day = new Date(`${date}T00:00:00`).getDay();
    const holiday = getHolidayName(date);
    if (day === 6) return "is-saturday";
    if (day === 0 || holiday) return "is-sunday-or-holiday";
    return "";
}

function weekdayClass(date: string) {
    const day = new Date(`${date}T00:00:00`).getDay();
    const holiday = getHolidayName(date);
    if (day === 6) return "weekday-sat";
    if (day === 0 || holiday) return "weekday-sun";
    return "";
}

export default function Calendar({
    dates,
    value,
    onChange,
    summaryByDate,
}: {
    dates: string[];
    value: Record<string, Status>;
    onChange: (date: string, status: Status) => void;
    summaryByDate?: Record<string, SummaryCounts>;
}) {
    const weeks = buildCalendarWeeks(dates);

    return (
        <>
            <div className="calendar desktop">
                <div className="week-head">
                    {["日", "月", "火", "水", "木", "金", "土"].map((d) => (
                        <b key={d}>{d}</b>
                    ))}
                </div>

                {weeks.map((week, i) => (
                    <div className="week" key={i}>
                        {week.map((date, j) => {
                            if (!date) {
                                return <div key={j} className="day empty" />;
                            }

                            const holiday = getHolidayName(date);

                            return (
                                <div className={`day ${dayClass(date)}`} key={date}>
                                    <strong>
                                        {displayDate(date)}（<span className={weekdayClass(date)}>{weekday(date)}</span>）
                                    </strong>

                                    {holiday && (
                                        <div className="holiday">🎌 {holiday}</div>
                                    )}

                                    <AvailabilitySummary counts={summaryByDate?.[date]} />

                                    <StatusButtons
                                        current={value[date]}
                                        onPick={(s) => onChange(date, s)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className="mobile-list">
                {dates.map((date) => (
                    <div className={`mobile-day ${dayClass(date)}`} key={date}>
                        <strong>
                            {displayDate(date)}（<span className={weekdayClass(date)}>{weekday(date)}</span>）
                        </strong>

                        {getHolidayName(date) && (
                            <div className="holiday">🎌 {getHolidayName(date)}</div>
                        )}

                        <AvailabilitySummary counts={summaryByDate?.[date]} />

                        <StatusButtons
                            current={value[date]}
                            onPick={(s) => onChange(date, s)}
                        />
                    </div>
                ))}
            </div>
        </>
    );
}
