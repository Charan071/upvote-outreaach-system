import { prisma } from "./prisma";
import type { Settings } from "@prisma/client";
import {
  sendInvitation,
  startChat,
  isLinkedInLimitError,
  isAlreadyConnectedError,
  isAlreadyInvitedError,
  hasPendingSentInvitation,
  clearSentInvitationCache,
} from "./unipile";
import { enrichContact } from "./enrich";
import { isDisconnectedStatus, recordLinkedInFailure, syncUnipileStatus } from "./health";
import {
  ALREADY_CONNECTED_ERROR,
  ALREADY_INVITED_ERROR,
  markInvitedAndSkipJobs,
  shouldSkipInvite,
} from "./connected";
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
import { resolveTimeZone, startOfZonedDay } from "./time";

export async function getSettings(): Promise<Settings> {
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
  const timezone = resolveTimeZone(row.timezone);
  const today = startOfZonedDay(now, timezone);
  const weekStart = row.weekStart ?? now;
  const weekElapsed = now.getTime() - weekStart.getTime() >= 7 * 24 * 60 * 60 * 1000;
  const dayRollover = !row.windowStart || row.windowStart < today;
  const oldJitter = row.minJitterSec === 45 && row.maxJitterSec === 120;
  const badWorkHours = row.workStartHour === 0 && row.workEndHour === 24;

  if (dayRollover || weekElapsed || oldJitter || badWorkHours) {
    const updated = await prisma.settings.update({
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
    return snapNextAllowedAt(updated, now);
  }

  return snapNextAllowedAt(row, now);
}

async function snapNextAllowedAt(row: Settings, now: Date) {
  const limits = asLimitSettings(row);
  if (isWorkingTime(limits, row.nextAllowedAt)) return row;
  const snapped = nextWorkingMoment(limits, row.nextAllowedAt > now ? row.nextAllowedAt : now);
  if (snapped.getTime() === row.nextAllowedAt.getTime()) return row;
  return prisma.settings.update({
    where: { id: "default" },
    data: { nextAllowedAt: snapped },
  });
}

export function asLimitSettings(row: Settings): LimitSettings {
  const jitter = clampJitter(row.minJitterSec, row.maxJitterSec);
  return {
    accountTier: row.accountTier === "free" ? "free" : "paid",
    timezone: resolveTimeZone(row.timezone),
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

async function markProfileCooldown() {
  await prisma.settings.update({
    where: { id: "default" },
    data: { lastActionAt: new Date() },
  });
}

function profileSpacingBlocked(row: Settings, now = new Date()) {
  if (!row.lastActionAt) return null;
  const elapsed = now.getTime() - row.lastActionAt.getTime();
  if (elapsed < row.minJitterSec * 1000) return "jitter" as const;
  return null;
}

export async function armCampaign(campaignId: string) {
  const campaign = await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "running" },
  });
  const scheduled = await spreadQueuedJobs(campaignId);
  await completeCampaignIfDone(campaignId);
  return { campaign: (await prisma.campaign.findUnique({ where: { id: campaignId } })) ?? campaign, scheduled };
}

/** Mark a running campaign completed when nothing is left to send. */
export async function completeCampaignIfDone(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (!campaign || campaign.status !== "running") return false;

  const remaining = await prisma.campaignContact.count({
    where: { campaignId, sendStatus: { in: ["queued", "sending"] } },
  });
  if (remaining > 0) return false;

  const total = await prisma.campaignContact.count({ where: { campaignId } });
  if (total === 0) return false;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: { status: "completed" },
  });
  return true;
}

/** Backfill: complete every running campaign with no queued/sending work. */
export async function completeFinishedCampaigns() {
  const candidates = await prisma.campaign.findMany({
    where: {
      status: "running",
      contacts: { some: {} },
      NOT: { contacts: { some: { sendStatus: { in: ["queued", "sending"] } } } },
    },
    select: { id: true },
  });
  if (!candidates.length) return 0;
  await prisma.campaign.updateMany({
    where: { id: { in: candidates.map((row) => row.id) } },
    data: { status: "completed" },
  });
  return candidates.length;
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

export async function respreadQueueFromNow() {
  await prisma.settings.update({
    where: { id: "default" },
    data: { nextAllowedAt: new Date() },
  });
  return spreadQueuedJobs();
}

export async function repairQueueIfNeeded() {
  const settings = asLimitSettings(await getSettings());
  const queued = await prisma.campaignContact.findMany({
    where: { sendStatus: "queued", campaign: { status: "running" } },
    select: { runAfter: true },
  });
  if (!queued.some((job) => !isWorkingTime(settings, job.runAfter))) return 0;
  return spreadQueuedJobs();
}

export async function tickQueue() {
  await syncUnipileStatus();
  await repairQueueIfNeeded();
  await completeFinishedCampaigns();
  const raw = await getSettings();
  const settings = asLimitSettings(raw);
  const now = new Date();

  if (isDisconnectedStatus(raw.unipileStatus)) {
    return { processed: 0, reason: "disconnected" as const, detail: raw.lastError };
  }
  if (settings.paused) {
    return { processed: 0, reason: "paused" as const, detail: raw.pausedReason };
  }

  const working = isWorkingTime(settings, now);
  const sendCooldown = now < settings.nextAllowedAt;

  const inviteBlocked = reasonBlocked(settings, "invite", now);
  const messageBlocked = reasonBlocked(settings, "message", now);

  const findDueJob = () =>
    prisma.campaignContact.findFirst({
      where: {
        sendStatus: "queued",
        runAfter: { lte: now },
        campaign: { status: "running" },
        contact: { enrichStatus: "ready", poolStatus: { not: "excluded" } },
      },
      include: { campaign: true, contact: true },
      orderBy: { runAfter: "asc" },
    });

  let job = await findDueJob();
  let skipped = 0;
  while (
    job &&
    job.campaign.kind === "invite" &&
    shouldSkipInvite(job.contact.outreachStatus) &&
    skipped < 10
  ) {
    await prisma.campaignContact.updateMany({
      where: { id: job.id, sendStatus: "queued" },
      data: { sendStatus: "skipped", error: ALREADY_CONNECTED_ERROR },
    });
    skipped += 1;
    job = await findDueJob();
  }
  if (skipped) {
    await spreadQueuedJobs();
    await completeFinishedCampaigns();
  }

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

  if (job && canSendJob && working && !sendCooldown) {
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
        const alreadyPending = await hasPendingSentInvitation({
          providerId,
          linkedinSlug: job.contact.linkedinSlug,
        });
        if (alreadyPending) {
          await markInvitedAndSkipJobs(job.contactId, now);
          await spreadQueuedJobs();
          await completeFinishedCampaigns();
          return { processed: 1, reason: "skipped" as const, contactId: job.contactId };
        }

        const result = (await sendInvitation(providerId, job.renderedMessage)) as {
          invitation_id?: string;
          id?: string;
        };
        unipileId = result.invitation_id ?? result.id;
        clearSentInvitationCache();
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
      await completeCampaignIfDone(job.campaignId);
      return { processed: 1, reason: "sent" as const, contactId: job.contactId, nextAllowedAt };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Send failed";
      if (job.campaign.kind === "invite" && isAlreadyConnectedError(error)) {
        await prisma.campaignContact.update({
          where: { id: job.id },
          data: { sendStatus: "skipped", error: ALREADY_CONNECTED_ERROR },
        });
        if (job.contact.outreachStatus !== "messaged") {
          await prisma.contact.update({
            where: { id: job.contactId },
            data: { outreachStatus: "connected" },
          });
        }
        await spreadQueuedJobs();
        await completeCampaignIfDone(job.campaignId);
        return { processed: 1, reason: "skipped" as const, contactId: job.contactId };
      }
      if (job.campaign.kind === "invite" && isAlreadyInvitedError(error)) {
        await markInvitedAndSkipJobs(job.contactId, now);
        await prisma.campaignContact.update({
          where: { id: job.id },
          data: { sendStatus: "skipped", error: ALREADY_INVITED_ERROR, sentAt: now },
        }).catch(() => null);
        clearSentInvitationCache();
        await spreadQueuedJobs();
        await completeFinishedCampaigns();
        return { processed: 1, reason: "skipped" as const, contactId: job.contactId };
      }
      await prisma.campaignContact.update({
        where: { id: job.id },
        data: { sendStatus: "failed", error: message },
      });
      if (isLinkedInLimitError(error)) {
        await recordLinkedInFailure(error, {
          pause: true,
          pausedReason: "LinkedIn returned 429/500. Sending paused to avoid automation warnings.",
        });
        await spreadQueuedJobs();
      } else {
        await recordLinkedInFailure(error);
        await markCooldown();
      }
      await completeCampaignIfDone(job.campaignId);
      return { processed: 0, reason: "failed" as const, error: message };
    }
  }

  const profileBlocked = reasonBlocked(settings, "profile", now);
  const profileSpacing = profileSpacingBlocked(raw, now);
  if (profileBlocked || profileSpacing) {
    return {
      processed: 0,
      reason: profileSpacing ?? profileBlocked ?? "daily_cap",
    };
  }

  const pending = await prisma.contact.findFirst({
    where: { enrichStatus: "pending" },
    orderBy: { createdAt: "asc" },
  });
  if (!pending) {
    if (skipped) return { processed: skipped, reason: "skipped" as const };
    if (sendCooldown) {
      return { processed: 0, reason: "jitter" as const, nextAllowedAt: settings.nextAllowedAt };
    }
    if (!working) return { processed: 0, reason: "outside_hours" as const };
    return { processed: 0, reason: "empty" as const };
  }

  try {
    await enrichContact(pending.id, { countVisit: true });
    await markProfileCooldown();
    await spreadQueuedJobs();
    return { processed: 1, reason: "enriched" as const, contactId: pending.id };
  } catch (error) {
    return {
      processed: 0,
      reason: "failed" as const,
      error: error instanceof Error ? error.message : "Enrich failed",
    };
  }
}
