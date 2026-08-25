import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/queue";
import { assertInviteCopy, defaultTemplate } from "@/lib/template";
import {
  clampInviteDailyCap,
  clampJitter,
  clampMessageDailyCap,
  clampProfileDailyCap,
  clampWeeklyInviteCap,
} from "@/lib/limits";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  const accountTier = body?.accountTier === "free" ? "free" : "paid";
  const jitter = clampJitter(Number(body?.minJitterSec) || 480, Number(body?.maxJitterSec) || 1500);
  const workStartHour = Math.min(23, Math.max(0, Number(body?.workStartHour) ?? 9));
  const workEndHour = Math.min(24, Math.max(workStartHour + 1, Number(body?.workEndHour) ?? 18));
  const template = typeof body?.defaultTemplate === "string" ? body.defaultTemplate.trim() : null;
  if (template) {
    const copyError = assertInviteCopy(template);
    if (copyError) return NextResponse.json({ error: copyError }, { status: 400 });
  }

  const data = {
    paused: Boolean(body?.paused),
    pausedReason: body?.paused ? undefined : null,
    accountTier,
    timezone: "UTC",
    workStartHour,
    workEndHour,
    workDays: String(body?.workDays || "1,2,3,4,5"),
    dailyCap: clampInviteDailyCap(accountTier, Number(body?.dailyCap) || 15),
    messageDailyCap: clampMessageDailyCap(Number(body?.messageDailyCap) || 20),
    profileDailyCap: clampProfileDailyCap(Number(body?.profileDailyCap) || 40),
    weeklyInviteCap: clampWeeklyInviteCap(accountTier, Number(body?.weeklyInviteCap) || 80),
    ...(template ? { defaultTemplate: template } : {}),
    minJitterSec: jitter.minJitterSec,
    maxJitterSec: jitter.maxJitterSec,
  };

  const settings = await prisma.settings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", defaultTemplate: template || defaultTemplate(), ...data },
  });
  return NextResponse.json({ settings });
}
