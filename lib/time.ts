export const APP_TIMEZONE = "UTC";

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function resolveTimeZone(value: string | null | undefined): string {
  const tz = (value ?? "").trim() || APP_TIMEZONE;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return APP_TIMEZONE;
  }
}

function partMap(date: Date, timeZone: string) {
  const map: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat("en-GB", {
    timeZone: resolveTimeZone(timeZone),
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  let hour = Number(map.hour);
  if (hour === 24) hour = 0;
  return { map, hour };
}

export function tzOffsetMs(date: Date, timeZone: string) {
  const { map, hour } = partMap(date, timeZone);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second),
  );
  return asUtc - date.getTime();
}

export function zonedWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
) {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const once = utcGuess - tzOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - tzOffsetMs(new Date(once), timeZone));
}

export function zonedParts(date: Date, timeZone: string) {
  const { map, hour } = partMap(date, timeZone);
  return {
    weekday: WEEKDAY[map.weekday] ?? 0,
    hour,
    minute: Number(map.minute),
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function startOfZonedDay(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone);
  return zonedWallTimeToUtc(parts.year, parts.month, parts.day, 0, 0, timeZone);
}

export function startOfUtcDay(date: Date) {
  return startOfZonedDay(date, APP_TIMEZONE);
}

export function utcParts(date: Date) {
  return zonedParts(date, APP_TIMEZONE);
}

export function addUtcMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function formatUtcClock(date: Date) {
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

export function formatUtcDateTime(date: Date) {
  const iso = date.toISOString().slice(0, 16).replace("T", " ");
  return `${iso} UTC`;
}

export function formatUtcSchedule(date: Date, now = new Date()) {
  const stamp = formatUtcDateTime(date);
  if (date.getTime() <= now.getTime() + 30_000) return `Due now · ${stamp}`;
  return stamp;
}

export function formatUtcHourRange(startHour: number, endHour: number) {
  const start = `${String(startHour).padStart(2, "0")}:00`;
  const end = `${String(endHour).padStart(2, "0")}:00`;
  return `${start}–${end} UTC`;
}

export function formatLocalDateTime(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatLocalSchedule(date: Date, now = new Date()) {
  const stamp = formatLocalDateTime(date);
  if (date.getTime() <= now.getTime() + 30_000) return `Due now · ${stamp}`;
  return stamp;
}

export function formatLocalClock(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function clockAtHour(hour: number, timeZone: string | undefined, now: Date) {
  let date: Date;
  if (timeZone) {
    const parts = zonedParts(now, timeZone);
    date = zonedWallTimeToUtc(parts.year, parts.month, parts.day, hour, 0, timeZone);
  } else {
    date = new Date(now);
    date.setHours(hour, 0, 0, 0);
  }
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

export function formatLocalHourRange(startHour: number, endHour: number, timeZone?: string, now = new Date()) {
  const tz = timeZone ? resolveTimeZone(timeZone) : undefined;
  const wallClock = tz && tz !== APP_TIMEZONE;
  if (!wallClock) {
    const start = new Date(now);
    start.setUTCHours(startHour, 0, 0, 0);
    const end = new Date(now);
    end.setUTCHours(endHour, 0, 0, 0);
    const clock = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
    return `${clock.format(start)}–${clock.format(end)}`;
  }
  return `${clockAtHour(startHour, tz, now)}–${clockAtHour(endHour, tz, now)}`;
}

export function formatJitterPhrase(minSec: number, maxSec: number) {
  if (minSec === maxSec) {
    if (minSec >= 3600 && minSec % 3600 === 0) {
      const hours = minSec / 3600;
      return `a ${hours}-hour gap`;
    }
    if (minSec >= 60 && minSec % 60 === 0) {
      const minutes = minSec / 60;
      return `a ${minutes}-minute gap`;
    }
    return `a ${minSec}-second gap`;
  }
  if (minSec % 60 === 0 && maxSec % 60 === 0 && minSec >= 60 && maxSec >= 60) {
    const start = minSec / 60;
    const article = start === 8 || start === 11 || start === 18 ? "an" : "a";
    return `${article} ${start}–${maxSec / 60} minute gap`;
  }
  return `a ${minSec}–${maxSec} second gap`;
}
