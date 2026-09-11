/**
 * Schedule + clock. Everything that decides "is the reveal open yet" lives
 * here, and every answer is derived from a shared server clock rather than
 * the device clock — a phone five minutes fast must not see the reveal early.
 */

/** Offset in ms to add to Date.now() to get server time. */
let clockOffsetMs = 0;

export function setClockOffset(offset: number): void {
  clockOffsetMs = offset;
}

export function serverNow(): number {
  return Date.now() + clockOffsetMs;
}

export function getClockOffset(): number {
  return clockOffsetMs;
}

/**
 * Estimate the offset from a server timestamp sampled around a round trip.
 * Half the round trip is attributed to the response leg, which is the usual
 * (and good enough) NTP-style approximation.
 */
export function estimateOffset(sentAt: number, serverTime: number, receivedAt: number): number {
  const roundTrip = receivedAt - sentAt;
  return serverTime + roundTrip / 2 - receivedAt;
}

/** YYYY-MM-DD for an instant, in a given IANA timezone. */
export function dayKey(instant: number, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "01";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** The UTC offset (in minutes) that `timezone` is at, at a given instant. */
function tzOffsetMinutes(instant: number, timezone: string): number {
  // Format the instant as if it were wall-clock in the zone, read it back as
  // UTC, and diff. Handles DST because it is evaluated at that instant.
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (asUtc - Math.floor(instant / 1000) * 1000) / 60_000;
}

/**
 * Epoch ms for `hour:00` local time on `day` (YYYY-MM-DD) in `timezone`.
 * Resolved in two passes so the offset is read at the target instant, not at
 * "now" — otherwise a schedule set the day before a DST shift lands an hour out.
 */
export function localHourToEpoch(day: string, hour: number, timezone: string): number {
  const [year, month, date] = day.split("-").map(Number);
  const naiveUtc = Date.UTC(year, month - 1, date, hour, 0, 0);
  const firstPass = naiveUtc - tzOffsetMinutes(naiveUtc, timezone) * 60_000;
  return naiveUtc - tzOffsetMinutes(firstPass, timezone) * 60_000;
}

export interface Schedule {
  day: string;
  dropAt: number;
  revealAt: number;
}

/**
 * The schedule currently in play. Before the drop hour, that is still
 * *today's* round (counting down); after the reveal it stays today's round
 * until midnight, so the showdown remains readable all evening.
 */
export function currentSchedule(
  now: number,
  timezone: string,
  dropHour: number,
  revealHour: number,
): Schedule {
  const day = dayKey(now, timezone);
  return {
    day,
    dropAt: localHourToEpoch(day, dropHour, timezone),
    revealAt: localHourToEpoch(day, revealHour, timezone),
  };
}

export type Phase = "locked" | "open" | "revealed";

export function phaseFor(now: number, schedule: Schedule): Phase {
  if (now < schedule.dropAt) return "locked";
  if (now < schedule.revealAt) return "open";
  return "revealed";
}

export interface Countdown {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function countdown(toEpoch: number, now: number): Countdown {
  const totalMs = Math.max(0, toEpoch - now);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    totalMs,
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export function formatCountdown(c: Countdown): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(c.hours)}:${pad(c.minutes)}:${pad(c.seconds)}`;
}
