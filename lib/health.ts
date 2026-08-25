import { prisma } from "./prisma";
import {
  clampInviteDailyCap,
  clampMessageDailyCap,
  clampProfileDailyCap,
  clampWeeklyInviteCap,
  remaining,
} from "./limits";
import { defaultTemplate } from "./template";
import { getLinkedInAccount, isOurUnipileAccount, linkedInAccountConfigured, UnipileError } from "./unipile";

export type AccountHealth =
  | "healthy"
  | "warning"
  | "paused"
  | "rate_limited"
  | "restricted"
  | "disconnected";

const DISCONNECTED_STATUSES = new Set(["CREDENTIALS", "STOPPED", "ERROR", "DELETED", "PERMISSIONS", "DISCONNECTED"]);

export function isDisconnectedStatus(status: string | null | undefined) {
  return Boolean(status && DISCONNECTED_STATUSES.has(status.toUpperCase()));
}

export function healthTone(health: AccountHealth): "good" | "warn" | "bad" | "accent" | "neutral" {
  if (health === "healthy") return "good";
  if (health === "warning" || health === "paused" || health === "rate_limited") return "warn";
  if (health === "restricted" || health === "disconnected") return "bad";
  return "neutral";
}

export function healthLabel(health: AccountHealth) {
  return health.replaceAll("_", " ");
}

async function ensureSettings() {
  await prisma.settings.upsert({
    where: { id: "default" },
    create: { id: "default", defaultTemplate: defaultTemplate() },
    update: {},
  });
}

export function deriveAccountHealth(input: {
  configured: boolean;
  unipileStatus: string | null;
  paused: boolean;
  pausedReason: string | null;
  invitesToday: number;
  dailyCap: number;
  invitesThisWeek: number;
  weeklyInviteCap: number;
  consecutiveFailures: number;
}): { health: AccountHealth; warning: string | null } {
  const reason = input.pausedReason || "";
  const inviteRemaining = remaining(input.invitesToday, input.dailyCap);
  const weeklyRemaining = remaining(input.invitesThisWeek, input.weeklyInviteCap);
  const lowRemaining = input.dailyCap > 0 && inviteRemaining / input.dailyCap <= 0.2;

  if (!input.configured || isDisconnectedStatus(input.unipileStatus)) {
    return {
      health: "disconnected",
      warning: input.configured
        ? `Unipile status is ${input.unipileStatus}. Reconnect the LinkedIn session in Unipile.`
        : "Set UNIPILE_DSN, UNIPILE_TOKEN, and UNIPILE_ACCOUNT_ID.",
    };
  }

  if (/cannot_resend/i.test(reason) || /restriction/i.test(reason)) {
    return { health: "restricted", warning: reason || "LinkedIn restricted this account." };
  }

  if (input.paused && /429|500|profile-visit limit/i.test(reason)) {
    return { health: "rate_limited", warning: reason };
  }

  if (inviteRemaining <= 0 || weeklyRemaining <= 0) {
    return {
      health: "rate_limited",
      warning: weeklyRemaining <= 0 ? "Weekly invite cap reached." : "Daily invite cap reached.",
    };
  }

  if (input.paused) {
    return { health: "paused", warning: reason || "LinkedIn actions are paused." };
  }

  if (input.unipileStatus?.toUpperCase() === "CONNECTING") {
    return { health: "warning", warning: "Unipile is still connecting this LinkedIn session." };
  }

  if (input.consecutiveFailures > 0) {
    return {
      health: "warning",
      warning: `${input.consecutiveFailures} consecutive LinkedIn failure${input.consecutiveFailures === 1 ? "" : "s"}.`,
    };
  }

  if (lowRemaining) {
    return { health: "warning", warning: `${inviteRemaining} invite${inviteRemaining === 1 ? "" : "s"} left today.` };
  }

  return { health: "healthy", warning: null };
}

export function startCampaignBlock(input: {
  health: AccountHealth;
  paused: boolean;
  pausedReason: string | null;
  kind: "invite" | "message";
  invitesToday: number;
  dailyCap: number;
  invitesThisWeek: number;
  weeklyInviteCap: number;
  messagesToday: number;
  messageDailyCap: number;
}) {
  if (input.health === "disconnected") {
    return "LinkedIn is disconnected. Fix Unipile before starting a campaign.";
  }
  if (input.paused || input.health === "paused") {
    return input.pausedReason || "LinkedIn actions are paused.";
  }
  if (input.health === "restricted") {
    return input.pausedReason || "LinkedIn restricted this account.";
  }
  if (input.kind === "invite") {
    if (remaining(input.invitesToday, input.dailyCap) <= 0) return "Daily invite cap reached. Nothing left to send today.";
    if (remaining(input.invitesThisWeek, input.weeklyInviteCap) <= 0) {
      return "Weekly invite cap reached. Nothing left to send this week.";
    }
  } else if (remaining(input.messagesToday, input.messageDailyCap) <= 0) {
    return "Daily message cap reached. Nothing left to send today.";
  }
  return null;
}

export async function recordLinkedInFailure(error: unknown, opts?: { pause?: boolean; pausedReason?: string }) {
  await ensureSettings();
  const message = error instanceof Error ? error.message : String(error);
  await prisma.settings.update({
    where: { id: "default" },
    data: {
      lastError: message.slice(0, 500),
      consecutiveFailures: { increment: 1 },
      ...(opts?.pause
        ? {
            paused: true,
            pausedReason: opts.pausedReason,
          }
        : {}),
    },
  });
}

export async function applyUnipileStatus(status: string, accountId?: string) {
  if (!isOurUnipileAccount(accountId)) return false;
  await ensureSettings();
  await prisma.settings.update({
    where: { id: "default" },
    data: {
      unipileStatus: status.toUpperCase() || null,
      lastSyncAt: new Date(),
      ...(isDisconnectedStatus(status) ? { lastError: `Unipile account status ${status}` } : {}),
    },
  });
  return true;
}

export async function syncUnipileStatus() {
  await ensureSettings();
  if (!linkedInAccountConfigured()) {
    await prisma.settings.update({
      where: { id: "default" },
      data: {
        unipileStatus: "DISCONNECTED",
        lastSyncAt: new Date(),
        lastError: "UNIPILE_DSN, UNIPILE_TOKEN, or UNIPILE_ACCOUNT_ID is missing.",
      },
    });
    return "DISCONNECTED";
  }

  try {
    const account = await getLinkedInAccount();
    await prisma.settings.update({
      where: { id: "default" },
      data: {
        unipileStatus: account.status,
        lastSyncAt: new Date(),
        ...(isDisconnectedStatus(account.status) ? { lastError: `Unipile account status ${account.status}` } : {}),
      },
    });
    return account.status;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unipile account lookup failed";
    const missing = error instanceof UnipileError && (error.status === 404 || error.status === 410);
    await prisma.settings.update({
      where: { id: "default" },
      data: {
        lastSyncAt: new Date(),
        lastError: message.slice(0, 500),
        ...(missing ? { unipileStatus: "DISCONNECTED" } : {}),
      },
    });
    return missing ? "DISCONNECTED" : null;
  }
}

export async function getAccountSnapshot(settings: {
  accountTier: string;
  paused: boolean;
  pausedReason: string | null;
  unipileStatus: string | null;
  lastSyncAt: Date | null;
  lastError: string | null;
  consecutiveFailures: number;
  dailyCap: number;
  weeklyInviteCap: number;
  messageDailyCap: number;
  profileDailyCap: number;
  invitesToday: number;
  invitesThisWeek: number;
  messagesToday: number;
  profilesToday: number;
  nextAllowedAt: Date | null;
}) {
  const dailyCap = clampInviteDailyCap(settings.accountTier, settings.dailyCap);
  const weeklyInviteCap = clampWeeklyInviteCap(settings.accountTier, settings.weeklyInviteCap);
  const messageDailyCap = clampMessageDailyCap(settings.messageDailyCap);
  const profileDailyCap = clampProfileDailyCap(settings.profileDailyCap);

  const { health, warning } = deriveAccountHealth({
    configured: linkedInAccountConfigured(),
    unipileStatus: settings.unipileStatus,
    paused: settings.paused,
    pausedReason: settings.pausedReason,
    invitesToday: settings.invitesToday,
    dailyCap,
    invitesThisWeek: settings.invitesThisWeek,
    weeklyInviteCap,
    consecutiveFailures: settings.consecutiveFailures,
  });

  const queued = await prisma.campaignContact.count({
    where: { sendStatus: "queued", campaign: { status: "running" } },
  });

  return {
    settings,
    health,
    warning,
    queued,
    dailyCap,
    weeklyInviteCap,
    messageDailyCap,
    profileDailyCap,
    remaining: {
      invites: remaining(settings.invitesToday, dailyCap),
      weeklyInvites: remaining(settings.invitesThisWeek, weeklyInviteCap),
      messages: remaining(settings.messagesToday, messageDailyCap),
      profiles: remaining(settings.profilesToday, profileDailyCap),
    },
  };
}
