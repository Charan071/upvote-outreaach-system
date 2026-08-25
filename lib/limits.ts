/**
 * Conservative LinkedIn limits from Unipile:
 * https://developer.unipile.com/docs/provider-limits-and-restrictions
 *
 * Limits are per LinkedIn account, independent per route, and do not accumulate.
 * Unipile does not enforce them; LinkedIn returns 429/500/422 cannot_resend_yet.
 */

import { resolveTimeZone, zonedParts, zonedWallTimeToUtc } from "./time";

export const UNIPILE_LINKEDIN = {
  paid: {
    inviteDailyMax: 80,
    inviteWeeklyMax: 200,
    inviteNoteMax: 300,
    recommendedDailyInvites: 50,
  },
  free: {
    inviteDailyMax: 15,
    inviteWeeklyMax: 150,
    inviteMonthlyWithNote: 5,
    inviteNoteMax: 200,
  },
  profileVisitDailyMax: 100,
  messageDailyMax: 100,
  warmupInviteDaily: 15,
  warmupProfileDaily: 40,
  warmupMessageDaily: 20,
  minJitterSec: 480,
  maxJitterSec: 1500,
} as const;

export type AccountTier = "paid" | "free";

export type LimitSettings = {
  accountTier: string;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  workDays: string;
  dailyCap: number;
  messageDailyCap: number;
  profileDailyCap: number;
  weeklyInviteCap: number;
  minJitterSec: number;
  maxJitterSec: number;
  paused: boolean;
  nextAllowedAt: Date;
  invitesToday: number;
  messagesToday: number;
  profilesToday: number;
  invitesThisWeek: number;
};

export function inviteNoteMax(tier: string) {
  return tier === "free" ? UNIPILE_LINKEDIN.free.inviteNoteMax : UNIPILE_LINKEDIN.paid.inviteNoteMax;
}

export function inviteDailyMax(tier: string) {
  return tier === "free" ? UNIPILE_LINKEDIN.free.inviteDailyMax : UNIPILE_LINKEDIN.paid.inviteDailyMax;
}

export function inviteWeeklyMax(tier: string) {
  return tier === "free" ? UNIPILE_LINKEDIN.free.inviteWeeklyMax : UNIPILE_LINKEDIN.paid.inviteWeeklyMax;
}

export function remaining(used: number, cap: number) {
  return Math.max(0, cap - used);
}

export function clampInviteDailyCap(tier: string, value: number) {
  const max = tier === "free" ? UNIPILE_LINKEDIN.free.inviteDailyMax : UNIPILE_LINKEDIN.paid.inviteDailyMax;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

export function clampWeeklyInviteCap(tier: string, value: number) {
  const max = tier === "free" ? UNIPILE_LINKEDIN.free.inviteWeeklyMax : UNIPILE_LINKEDIN.paid.inviteWeeklyMax;
  return Math.max(1, Math.min(max, Math.floor(value)));
}

export function clampProfileDailyCap(value: number) {
  return Math.max(1, Math.min(UNIPILE_LINKEDIN.profileVisitDailyMax, Math.floor(value)));
}

export function clampMessageDailyCap(value: number) {
  return Math.max(1, Math.min(UNIPILE_LINKEDIN.messageDailyMax, Math.floor(value)));
}

export function clampJitter(minSec: number, maxSec: number) {
  const min = Math.max(120, Math.floor(minSec));
  const max = Math.max(min, Math.floor(maxSec));
  return { minJitterSec: min, maxJitterSec: max };
}

export function randomBetween(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function randomJitterMs(settings: { minJitterSec: number; maxJitterSec: number }) {
  return randomBetween(settings.minJitterSec, settings.maxJitterSec) * 1000;
}

export function isWorkingTime(settings: LimitSettings, date = new Date()) {
  const days = settings.workDays
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  const { weekday, hour } = zonedParts(date, settings.timezone);
  if (!days.includes(weekday)) return false;
  return hour >= settings.workStartHour && hour < settings.workEndHour;
}

export function nextWorkingMoment(settings: LimitSettings, from = new Date()) {
  if (isWorkingTime(settings, from)) return new Date(from.getTime());
  const tz = resolveTimeZone(settings.timezone);
  const days = settings.workDays
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));

  let probe = new Date(from.getTime());
  for (let i = 0; i < 14; i++) {
    const parts = zonedParts(probe, tz);
    if (days.includes(parts.weekday)) {
      const start = zonedWallTimeToUtc(parts.year, parts.month, parts.day, settings.workStartHour, 0, tz);
      if (start.getTime() >= from.getTime() && isWorkingTime(settings, start)) return start;
    }
    const noon = zonedWallTimeToUtc(parts.year, parts.month, parts.day, 12, 0, tz);
    probe = new Date(noon.getTime() + 24 * 60 * 60 * 1000);
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

export function reasonBlocked(settings: LimitSettings, kind: "invite" | "message" | "profile", now = new Date()) {
  if (settings.paused) return "paused" as const;
  if (now < settings.nextAllowedAt) return "jitter" as const;
  if (kind !== "profile" && !isWorkingTime(settings, now)) return "outside_hours" as const;
  if (kind === "invite") {
    if (settings.invitesToday >= settings.dailyCap) return "daily_cap" as const;
    if (settings.invitesThisWeek >= settings.weeklyInviteCap) return "weekly_cap" as const;
  }
  if (kind === "message" && settings.messagesToday >= settings.messageDailyCap) return "daily_cap" as const;
  if (kind === "profile" && settings.profilesToday >= settings.profileDailyCap) return "daily_cap" as const;
  return null;
}

export function spreadSlots(count: number, settings: LimitSettings, from = new Date()) {
  const slots: Date[] = [];
  let cursor = nextWorkingMoment(settings, from > settings.nextAllowedAt ? from : settings.nextAllowedAt);
  for (let i = 0; i < count; i++) {
    cursor = new Date(cursor.getTime() + (i === 0 ? 0 : randomJitterMs(settings)));
    cursor = nextWorkingMoment(settings, cursor);
    slots.push(new Date(cursor));
  }
  return slots;
}
