import { prisma } from "./prisma";
import { sendInvitation, startChat, isLinkedInLimitError, UnipileError } from "./unipile";
import { enrichContact } from "./enrich";
import { isDisconnectedStatus, recordLinkedInFailure, syncUnipileStatus } from "./health";
import {
  UNIPILE_LINKEDIN,
  clampInviteDailyCap,
  clampJitter,
  clampMessageDailyCap,
  clampProfileDailyCap,
  clampWeeklyInviteCap,
  isWorkingTime,
  nextWorkingMoment,
  randomJitterMs,
  reasonBlocked,
  spreadSlots,
  type LimitSettings,
} from "./limits";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: "default" } });
  const row =
    existing ??
    (await prisma.settings.create({
      data: {
        id: "default",
        defaultTemplate:
          "Hey {first_name}, I came across your work at {company} and wanted to connect. We're launching soon and I'd value your feedback if you have a minute.",
        minJitterSec: UNIPILE_LINKEDIN.minJitterSec,
        maxJitterSec: UNIPILE_LINKEDIN.maxJitterSec,
      },
    }));

  const now = new Date();
  const today = startOfUtcDay(now);
  const weekStart = row.weekStart ?? now;
  const weekElapsed = now.getTime() - weekStart.getTime() >= 7 * 24 * 60 * 60 * 1000;
  const dayRollover = !row.windowStart || row.windowStart < today;
  const oldJitter = row.minJitterSec === 45 && row.maxJitterSec === 120;
  const badWorkHours = row.workStartHour === 0 && row.workEndHour === 24;

  if (dayRollover || weekElapsed || oldJitter || badWorkHours) {
    return prisma.settings.update({
      where: { id: "default" },
      data: {
        ...(dayRollover
          ? {
              sentToday: 0,
              invitesToday: 0,
              messagesToday: 0,
              profilesToday: 0,
              contextCreditsUsedToday: 0,
              windowStart: today,
            }
          : {}),
        ...(weekElapsed ? { invitesThisWeek: 0, weekStart: now } : {}),
        ...(oldJitter
          ? { minJitterSec: UNIPILE_LINKEDIN.minJitterSec, maxJitterSec: UNIPILE_LINKEDIN.maxJitterSec }
          : {}),
        ...(badWorkHours ? { workStartHour: 9, workEndHour: 18 } : {}),
      },
    });
  }

  return row;
}

export function asLimitSettings(row: Awaited<ReturnType<typeof getSettings>>): LimitSettings {
  const jitter = clampJitter(row.minJitterSec, row.maxJitterSec);
  return {
    accountTier: row.accountTier === "free" ? "free" : "paid",
    timezone: row.timezone || "Asia/Kolkata",
    workStartHour: row.workStartHour,
    workEndHour: row.workEndHour,
    workDays: row.workDays || "1,2,3,4,5",
    dailyCap: clampInviteDailyCap(row.accountTier, row.dailyCap),
    messageDailyCap: clampMessageDailyCap(row.messageDailyCap),
    profileDailyCap: clampProfileDailyCap(row.profileDailyCap),
    weeklyInviteCap: clampWeeklyInviteCap(row.accountTier, row.weeklyInviteCap),
    minJitterSec: jitter.minJitterSec,
    maxJitterSec: jitter.maxJitterSec,
    paused: row.paused,
    nextAllowedAt: row.nextAllowedAt ?? new Date(0),
    invitesToday: row.invitesToday ?? 0,
    messagesToday: row.messagesToday ?? 0,
    profilesToday: row.profilesToday ?? 0,
    invitesThisWeek: row.invitesThisWeek ?? 0,
  };
}

async function markCooldown() {
  const settings = asLimitSettings(await getSettings());
  const wait = randomJitterMs(settings);
  const nextAllowedAt = nextWorkingMoment(settings, new Date(Date.now() + wait));
  await prisma.settings.update({
    where: { id: "default" },
    data: { nextAllowedAt, lastActionAt: new Date() },
  });
  return nextAllowedAt;
}

export async function armCampaign(campaignId: string) {
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "running" },
  });
  const scheduled = await spreadQueuedJobs(campaignId);
  return { campaign, scheduled };
}

export async function spreadQueuedJobs(campaignId?: string) {
  const settings = asLimitSettings(await getSettings());
  const queued = await prisma.campaignContact.findMany({
    where: {
      sendStatus: "queued",
      ...(campaignId ? { campaignId } : {}),
      campaign: { status: "running" },
    },
    include: { campaign: true },
    orderBy: { runAfter: "asc" },
  });
  if (!queued.length) return 0;

  const slots = spreadSlots(queued.length, settings, new Date());
  for (let i = 0; i < queued.length; i++) {
    await prisma.campaignContact.update({
      where: { id: queued[i].id },
      data: { runAfter: slots[i] },
    });
  }
  return queued.length;
}

export async function tickQueue() {
  await syncUnipileStatus();
  const raw = await getSettings();
  const settings = asLimitSettings(raw);
  const now = new Date();

  if (isDisconnectedStatus(raw.unipileStatus)) {
    return { processed: 0, reason: "disconnected" as const, detail: raw.lastError };
  }
  if (settings.paused) {
    return { processed: 0, reason: "paused" as const, detail: raw.pausedReason };
  }
  if (now < settings.nextAllowedAt) {
    return { processed: 0, reason: "jitter" as const, nextAllowedAt: settings.nextAllowedAt };
  }

  const working = isWorkingTime(settings, now);

  const inviteBlocked = reasonBlocked(settings, "invite", now);
  const messageBlocked = reasonBlocked(settings, "message", now);

  const job = await prisma.campaignContact.findFirst({
    where: {
      sendStatus: "queued",
      runAfter: { lte: now },
      campaign: { status: "running" },
      contact: { enrichStatus: "ready", poolStatus: { not: "excluded" } },
    },
    include: { campaign: true, contact: true },
    orderBy: { runAfter: "asc" },
  });

  const canSendJob =
    job &&
    ((job.campaign.kind === "invite" && !inviteBlocked) ||
      (job.campaign.kind !== "invite" && !messageBlocked));

  if (job && !canSendJob && (inviteBlocked === "daily_cap" || inviteBlocked === "weekly_cap" || messageBlocked === "daily_cap" || inviteBlocked === "outside_hours" || messageBlocked === "outside_hours")) {
    // Caps and off-hours block sending, not name lookups.
  } else if (job && !canSendJob) {
    return {
      processed: 0,
      reason: (job.campaign.kind === "invite" ? inviteBlocked : messageBlocked) ?? "daily_cap",
    };
  }

  if (job && canSendJob && working) {
    const claimed = await prisma.campaignContact.updateMany({
      where: { id: job.id, sendStatus: "queued" },
      data: { sendStatus: "sending" },
    });
    if (claimed.count !== 1) {
      return { processed: 0, reason: "empty" as const };
    }

    try {
      const providerId = job.contact.unipileProviderId;
      if (!providerId) throw new Error("Contact is missing Unipile provider_id");

      let unipileId: string | undefined;
      if (job.campaign.kind === "invite") {
        const result = (await sendInvitation(providerId, job.renderedMessage)) as {
          invitation_id?: string;
          id?: string;
        };
        unipileId = result.invitation_id ?? result.id;
      } else {
        const result = (await startChat(providerId, job.renderedMessage)) as { id?: string };
        unipileId = result.id;
      }

      const invite = job.campaign.kind === "invite";
      await prisma.$transaction([
        prisma.campaignContact.update({
          where: { id: job.id },
          data: {
            sendStatus: "sent",
            sentAt: now,
            unipileId: unipileId ?? null,
            error: null,
          },
        }),
        prisma.contact.update({
          where: { id: job.contactId },
          data: {
            outreachStatus: invite ? "invited" : "messaged",
            lastCampaignId: job.campaignId,
            lastOutboundAt: now,
          },
        }),
        prisma.settings.update({
          where: { id: "default" },
          data: {
            sentToday: { increment: 1 },
            consecutiveFailures: 0,
            lastError: null,
            ...(invite
              ? { invitesToday: { increment: 1 }, invitesThisWeek: { increment: 1 } }
              : { messagesToday: { increment: 1 } }),
          },
        }),
      ]);

      const nextAllowedAt = await markCooldown();
      await spreadQueuedJobs();
      return { processed: 1, reason: "sent" as const, contactId: job.contactId, nextAllowedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      await prisma.campaignContact.update({
        where: { id: job.id },
        data: { sendStatus: "failed", error: message },
      });
      if (isLinkedInLimitError(error)) {
        const type = error instanceof UnipileError ? error.type : "";
        const pausedReason = /cannot_resend/i.test(`${type} ${message}`)
          ? "LinkedIn invitation limit (422 cannot_resend_yet). Same cap as the LinkedIn UI. Remaining invites were pushed later."
          : "LinkedIn returned 429/500. Sending paused to avoid automation warnings.";
        await recordLinkedInFailure(error, { pause: true, pausedReason });
        await spreadQueuedJobs();
      } else {
        await recordLinkedInFailure(error);
        await markCooldown();
      }
      return { processed: 0, reason: "failed" as const, error: message };
    }
  }

  const profileBlocked = reasonBlocked(settings, "profile", now);
  if (profileBlocked) {
    return { processed: 0, reason: job ? "empty" : profileBlocked };
  }

  const pending = await prisma.contact.findFirst({
    where: { enrichStatus: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!pending) {
    if (!working) return { processed: 0, reason: "outside_hours" as const };
    return { processed: 0, reason: "empty" as const };
  }

  try {
    await enrichContact(pending.id, { countVisit: true });
    const nextAllowedAt = await markCooldown();
    return { processed: 1, reason: "enriched" as const, contactId: pending.id, nextAllowedAt };
  } catch (error) {
    return {
      processed: 0,
      reason: "failed" as const,
      error: error instanceof Error ? error.message : "Enrich failed",
    };
  }
}
