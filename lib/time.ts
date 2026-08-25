export const APP_TIMEZONE = "UTC";

export function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function utcParts(date: Date) {
  return {
    weekday: date.getUTCDay(),
    hour: date.getUTCHours(),
    minute: date.getUTCMinutes(),
  };
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

export function formatUtcHourRange(startHour: number, endHour: number) {
  const start = `${String(startHour).padStart(2, "0")}:00`;
  const end = `${String(endHour).padStart(2, "0")}:00`;
  return `${start}–${end} UTC`;
}
