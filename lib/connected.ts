import { prisma } from "./prisma";
import { listRelations } from "./unipile";

export const ALREADY_CONNECTED_ERROR = "Already connected";

export function shouldSkipInvite(outreachStatus: string) {
  return outreachStatus === "connected" || outreachStatus === "messaged";
}

export function isFirstDegreeProfile(profile: {
  networkDistance?: string | null;
  isRelationship?: boolean | null;
}) {
  if (profile.isRelationship === true) return true;
  const distance = String(profile.networkDistance ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  return distance === "FIRST_DEGREE" || distance === "SELF";
}

async function completeRunningCampaignsIfEmpty(campaignIds: string[]) {
  for (const campaignId of [...new Set(campaignIds)]) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { status: true },
    });
    if (!campaign || campaign.status !== "running") continue;
    const remaining = await prisma.campaignContact.count({
      where: { campaignId, sendStatus: { in: ["queued", "sending"] } },
    });
    if (remaining > 0) continue;
    const total = await prisma.campaignContact.count({ where: { campaignId } });
    if (total === 0) continue;
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: "completed" },
    });
  }
}

export async function skipQueuedInviteJobs(
  contactId: string,
  error = ALREADY_CONNECTED_ERROR,
) {
  const pending = await prisma.campaignContact.findMany({
    where: {
      contactId,
      sendStatus: { in: ["queued", "sending"] },
      campaign: { kind: "invite" },
    },
    select: { id: true, campaignId: true },
  });
  if (!pending.length) return 0;
  const result = await prisma.campaignContact.updateMany({
    where: { id: { in: pending.map((row) => row.id) } },
    data: { sendStatus: "skipped", error },
  });
  await completeRunningCampaignsIfEmpty(pending.map((row) => row.campaignId));
  return result.count;
}

/**
 * Attribute the accept to the invite we actually sent, so campaigns that never
 * reached this person (pre-existing connections, manual marks) stay out of the
 * conversion numbers.
 */
async function stampCampaignAcceptance(contactId: string, acceptedAt: Date) {
  const sentInvite = await prisma.campaignContact.findFirst({
    where: {
      contactId,
      sendStatus: "sent",
      acceptedAt: null,
      campaign: { kind: "invite" },
    },
    orderBy: { sentAt: "desc" },
    select: { id: true },
  });
  if (!sentInvite) return false;
  await prisma.campaignContact.update({
    where: { id: sentInvite.id },
    data: { acceptedAt },
  });
  return true;
}

export async function markConnectedAndSkipInvites(contactId: string, acceptedAt = new Date()) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return 0;

  const data: { outreachStatus?: string; acceptedAt?: Date } = {};
  if (contact.outreachStatus !== "messaged") data.outreachStatus = "connected";
  if (!contact.acceptedAt) data.acceptedAt = acceptedAt;
  if (Object.keys(data).length) {
    await prisma.contact.update({ where: { id: contactId }, data });
  }

  await stampCampaignAcceptance(contactId, contact.acceptedAt ?? acceptedAt);
  return skipQueuedInviteJobs(contactId);
}

/**
 * Reconcile accepted invites against the real first-degree list. Catches every
 * accept the new_relation webhook dropped, and is safe to re-run.
 */
export async function syncAcceptedRelations(opts?: { maxPages?: number }) {
  const relations = await listRelations({ maxPages: opts?.maxPages });
  const bySlug = new Set(relations.map((r) => r.publicIdentifier).filter(Boolean));
  const byProviderId = new Set(relations.map((r) => r.providerId).filter(Boolean));

  const pending = await prisma.contact.findMany({
    where: { OR: [{ outreachStatus: { not: "connected" } }, { acceptedAt: null }] },
    select: { id: true, linkedinSlug: true, unipileProviderId: true, outreachStatus: true },
  });

  const accepted: string[] = [];
  for (const contact of pending) {
    const isRelation =
      bySlug.has(contact.linkedinSlug.toLowerCase()) ||
      (contact.unipileProviderId ? byProviderId.has(contact.unipileProviderId) : false);
    if (!isRelation) continue;
    await markConnectedAndSkipInvites(contact.id);
    accepted.push(contact.linkedinSlug);
  }

  return { relations: relations.length, checked: pending.length, accepted };
}

export const ALREADY_INVITED_ERROR = "Invite already pending";

export async function markInvitedAndSkipJobs(contactId: string, sentAt = new Date()) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return 0;
  if (contact.outreachStatus === "never" || contact.outreachStatus === "queued") {
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        outreachStatus: "invited",
        lastOutboundAt: contact.lastOutboundAt ?? sentAt,
      },
    });
  }
  const pending = await prisma.campaignContact.findMany({
    where: {
      contactId,
      sendStatus: { in: ["queued", "sending"] },
      campaign: { kind: "invite" },
    },
    select: { id: true, campaignId: true },
  });
  if (!pending.length) return 0;
  const result = await prisma.campaignContact.updateMany({
    where: { id: { in: pending.map((row) => row.id) } },
    data: {
      sendStatus: "skipped",
      error: ALREADY_INVITED_ERROR,
      sentAt: contact.lastOutboundAt ?? sentAt,
    },
  });
  await completeRunningCampaignsIfEmpty(pending.map((row) => row.campaignId));
  return result.count;
}
