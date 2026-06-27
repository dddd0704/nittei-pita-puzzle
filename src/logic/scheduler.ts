import { isHolidayLike } from "../utils/holidays";
export type Status = 'ok' | 'night' | 'day' | 'maybe' | 'ng';
export type Role = 'host' | 'staff' | 'participant';
export type ConsecutivePreference =
  | 'none'
  | 'avoid_2_days'
  | 'avoid_3_days'
  | 'avoid_any';

export type SameDayRule = 'allow' | 'penalty' | 'ban';
export type MaybeRule = 'exclude' | 'penalty';
export type HostRule = 'host_required' | 'host_or_staff';
export type MinMode = 'all' | 'number';
export type Pref =
  | 'weekday'
  | 'holiday'
  | 'day'
  | 'night'
  | 'avoid_holiday_day';

export type Participant = {
  id: string;
  dbId?: string;
  name: string;
  role: Role;
  preferences: Pref[];
  consecutivePreference: ConsecutivePreference;
  comment: string;
};

export type AvailabilityMap = Record<string, Record<string, Status>>;

export type SessionSettings = {
  dbId?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  requiredSlots: number;
  minParticipantsMode: MinMode;
  minParticipantsCount: number;
  hostRule: HostRule;
  maybeRule: MaybeRule;
  sameDayRule: SameDayRule;
  shareId: string;
  ownerToken: string;
};

export type CandidateSlot = {
  date: string;
  part: '昼' | '夜';
  score: number;
  reasons: string[];
  warnings: string[];
};

export type SchedulePlan = {
  label: string;
  slots: CandidateSlot[];
  reasons: string[];
  warnings: string[];
  totalScore: number;
  complete: boolean;
};

export type ScheduleResult = {
  plans: SchedulePlan[];
  shortage: number;
  failHints: string[];
};

function parseParts(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

function dateDistance(a: string, b: string) {
  const pa = parseParts(a);
  const pb = parseParts(b);

  const da = new Date(pa.y, pa.m - 1, pa.d).getTime();
  const db = new Date(pb.y, pb.m - 1, pb.d).getTime();

  return Math.abs((da - db) / (1000 * 60 * 60 * 24));
}

function weekdayIndex(date: string) {
  const p = parseParts(date);
  return new Date(p.y, p.m - 1, p.d).getDay();
}

function isWeekend(date: string) {
  const d = weekdayIndex(date);
  return d === 0 || d === 6;
}

function canAttendStatus(
  status: Status | undefined,
  part: '昼' | '夜',
  maybeRule: MaybeRule
) {
  const s = status || 'maybe';

  if (s === 'ng') return false;
  if (s === 'ok') return true;
  if (s === 'day') return part === '昼';
  if (s === 'night') return part === '夜';

  return maybeRule === 'penalty';
}

function hasAdjacentDate(
  chosen: CandidateSlot[],
  date: string
) {
  return chosen.some((c) => dateDistance(c.date, date) === 1);
}

function applyParticipantPreferencePenalty(
  chosen: CandidateSlot[],
  participants: Participant[],
  availability: AvailabilityMap,
  maybeRule: MaybeRule
) {
  let penalty = 0;
  const warnings: string[] = [];

  for (const p of participants) {
    if (p.consecutivePreference === 'none') continue;

    const attendDates = Array.from(
      new Set(
        chosen
          .filter((slot) => {
            return canAttendStatus(
              availability[p.id]?.[slot.date],
              slot.part,
              maybeRule
            );
          })
          .map((slot) => slot.date)
      )
    ).sort();

    let adjacentPairs = 0;
    let longestRun = attendDates.length ? 1 : 0;
    let currentRun = attendDates.length ? 1 : 0;

    for (let i = 1; i < attendDates.length; i++) {
      if (dateDistance(attendDates[i - 1], attendDates[i]) === 1) {
        adjacentPairs += 1;
        currentRun += 1;
        longestRun = Math.max(longestRun, currentRun);
      } else {
        currentRun = 1;
      }
    }

    if (p.consecutivePreference === 'avoid_any' && adjacentPairs > 0) {
      penalty += adjacentPairs * 140;
      warnings.push(`${p.name}: 連日はなるべく避けたい`);
    }

    if (p.consecutivePreference === 'avoid_2_days' && adjacentPairs > 0) {
      penalty += adjacentPairs * 110;
      warnings.push(`${p.name}: 2日連続は避けたい`);
    }

    if (p.consecutivePreference === 'avoid_3_days' && longestRun >= 3) {
      penalty += (longestRun - 2) * 160;
      warnings.push(`${p.name}: 3日連続は避けたい`);
    }
  }

  return { penalty, warnings };
}

export function calculateScheduleResult(
  dates: string[],
  participants: Participant[],
  availability: AvailabilityMap,
  session: SessionSettings
): ScheduleResult {
  const slots = dates.flatMap((date) => [
    { date, part: '昼' as const },
    { date, part: '夜' as const },
  ]);

  const scored = slots
    .map((slot) => {
      let score = 100;
      const reasons: string[] = [];
      const warnings: string[] = [];

      const hosts = participants.filter((p) => p.role === 'host');
      const staffs = participants.filter((p) => p.role === 'staff');
      const players = participants.filter((p) => p.role === 'participant');

      const canAttend = (p: Participant) => {
        return canAttendStatus(
          availability[p.id]?.[slot.date],
          slot.part,
          session.maybeRule
        );
      };

      const hostOk =
        session.hostRule === 'host_required'
          ? hosts.some(canAttend)
          : [...hosts, ...staffs].some(canAttend);

      if (!hostOk) return null;

      const attendeePlayers = players.filter(canAttend);

      const min =
        session.minParticipantsMode === 'all'
          ? players.length
          : session.minParticipantsCount;

      if (attendeePlayers.length < min) return null;

      score += attendeePlayers.length * 20;
      reasons.push(`参加可能な参加者：${attendeePlayers.length}人`);

      if (slot.part === '夜') score += 3;

 for (const p of participants) {

  const s = availability[p.id]?.[slot.date] || "maybe";

  if (s === "maybe") {
    score -= 15;
    warnings.push(`${p.name}: 保留`);
  }

  if (p.preferences.includes("night") && slot.part === "夜") {
    score += 40;
  }

  if (p.preferences.includes("day") && slot.part === "昼") {
    score += 40;
  }

  // 平日優先（土日祝ではない日を優先）
  if (
    p.preferences.includes("weekday") &&
    !isHolidayLike(slot.date)
  ) {
    score += 70;
  }

  if (
    p.preferences.includes("weekday") &&
    isHolidayLike(slot.date)
  ) {
    score -= 60;
  }

  // 土日祝優先
  if (
    p.preferences.includes("holiday") &&
    isHolidayLike(slot.date)
  ) {
    score += 70;
  }

  if (
    p.preferences.includes("holiday") &&
    !isHolidayLike(slot.date)
  ) {
    score -= 30;
  }

  // 土日祝の昼は避けたい
  if (
    p.preferences.includes("avoid_holiday_day") &&
    isHolidayLike(slot.date) &&
    slot.part === "昼"
  ) {
    score -= 90;
    warnings.push(`${p.name}: 土日祝の昼は避けたい`);
  }
}

      return {
        ...slot,
        score,
        reasons,
        warnings,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b!.score - a!.score) as CandidateSlot[];

  function buildPlan(
    offset: number,
    label: string,
    preferNoConsecutive = false
  ): SchedulePlan {
    const chosen: CandidateSlot[] = [];

    for (const s of scored.slice(offset)) {
      if (
        session.sameDayRule === 'ban' &&
        chosen.some((c) => c.date === s.date)
      ) {
        continue;
      }

      if (preferNoConsecutive && hasAdjacentDate(chosen, s.date)) {
        continue;
      }

      chosen.push(s);

      if (chosen.length >= session.requiredSlots) break;
    }

    if (preferNoConsecutive && chosen.length < session.requiredSlots) {
      for (const s of scored.slice(offset)) {
        if (
          chosen.some(
            (c) => c.date === s.date && c.part === s.part
          )
        ) {
          continue;
        }

        if (
          session.sameDayRule === 'ban' &&
          chosen.some((c) => c.date === s.date)
        ) {
          continue;
        }

        chosen.push(s);

        if (chosen.length >= session.requiredSlots) break;
      }
    }

    const reasons = Array.from(
      new Set(chosen.flatMap((c) => c.reasons))
    );

    const baseWarnings = Array.from(
      new Set(chosen.flatMap((c) => c.warnings))
    );

    const preferencePenalty = applyParticipantPreferencePenalty(
      chosen,
      participants,
      availability,
      session.maybeRule
    );

    const warnings = Array.from(
      new Set([
        ...baseWarnings,
        ...preferencePenalty.warnings,
      ])
    );

    const totalScore =
      chosen.reduce((sum, s) => sum + s.score, 0) -
      preferencePenalty.penalty;

    if (preferencePenalty.penalty > 0) {
      reasons.push('参加者の連日希望を減点に反映');
    }

    return {
      label,
      slots: chosen,
      reasons,
      warnings,
      totalScore,
      complete: chosen.length >= session.requiredSlots,
    };
  }

  const plans = [
    buildPlan(0, '第1案'),
    buildPlan(0, '第2案', true),
    buildPlan(2, '第3案', true),
  ]
    .filter(
      (plan, index, arr) =>
        plan.slots.length > 0 &&
        arr.findIndex(
          (p) =>
            p.slots
              .map((s) => `${s.date}-${s.part}`)
              .join('|') ===
            plan.slots
              .map((s) => `${s.date}-${s.part}`)
              .join('|')
        ) === index
    )
    .slice(0, 3)
    .sort((a, b) => b.totalScore - a.totalScore);

  const best = plans[0];

  const shortage = best
    ? Math.max(0, session.requiredSlots - best.slots.length)
    : session.requiredSlots;

  const failHints =
    shortage > 0
      ? [
          `必要コマ数 ${session.requiredSlots} に対して、条件を満たすコマは最大 ${
            best?.slots.length || 0
          } コマです。`,
          '最低参加者人数を下げる、保留を許容する、昼夜開催を許可する、対象期間を広げる、のいずれかを試してください。',
        ]
      : [];

  return {
    plans,
    shortage,
    failHints,
  };
}