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
    { value: "ok", label: "⭕️" },
    { value: "night", label: "🌙" },
    { value: "day", label: "🌞" },
    { value: "maybe", label: "保留" },
    { value: "ng", label: "❌" },
] as const;

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
                    className={
                        current === o.value
                            ? "selected"
                            : ""
                    }
                    onClick={() => onPick(o.value)}
                >
                    {o.label}
                </button>

            ))}

        </div>

    );

}

export default function Calendar({

    dates,
    value,
    onChange,

}: {

    dates: string[];

    value: Record<string, Status>;

    onChange: (
        date: string,
        status: Status
    ) => void;

}) {

    const weeks =
        buildCalendarWeeks(dates);

    return (

        <>

            <div className="calendar desktop">

                <div className="week-head">

                    {
                        [
                            "日",
                            "月",
                            "火",
                            "水",
                            "木",
                            "金",
                            "土",
                        ].map((d) => (
                            <b key={d}>{d}</b>
                        ))
                    }

                </div>

                {

                    weeks.map((week, i) => (

                        <div
                            className="week"
                            key={i}
                        >

                            {

                                week.map((date, j) => {

                                    if (!date) {

                                        return (
                                            <div
                                                key={j}
                                                className="day empty"
                                            />
                                        );

                                    }

                                    const holiday =
                                        getHolidayName(date);

                                    return (

                                        <div
                                            className="day"
                                            key={date}
                                        >

                                            <strong>

                                                {displayDate(date)}

                                                （

                                                {weekday(date)}

                                                ）

                                            </strong>

                                            {

                                                holiday && (

                                                    <div className="holiday">

                                                        🎌 {holiday}

                                                    </div>

                                                )

                                            }

                                            <StatusButtons

                                                current={
                                                    value[
                                                        date
                                                    ]
                                                }

                                                onPick={(s) =>
                                                    onChange(
                                                        date,
                                                        s
                                                    )
                                                }

                                            />

                                        </div>

                                    );

                                })

                            }

                        </div>

                    ))

                }

            </div>

            <div className="mobile-list">

                {

                    dates.map((date) => (

                        <div
                            className="mobile-day"
                            key={date}
                        >

                            <strong>

                                {displayDate(date)}

                                （

                                {weekday(date)}

                                ）

                            </strong>

                            {

                                getHolidayName(date) && (

                                    <div className="holiday">

                                        🎌 {getHolidayName(date)}

                                    </div>

                                )

                            }

                            <StatusButtons

                                current={
                                    value[date]
                                }

                                onPick={(s) =>
                                    onChange(
                                        date,
                                        s
                                    )
                                }

                            />

                        </div>

                    ))

                }

            </div>

        </>

    );

}