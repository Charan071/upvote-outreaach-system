import { prisma } from "./prisma";

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

export async function skipQueuedInviteJobs(
  contactId: string,
  error = ALREADY_CONNECTED_ERROR,
) {
  const result = await prisma.campaignContact.updateMany({
    where: {
      contactId,
      sendStatus: { in: ["queued", "sending"] },
      campaign: { kind: "invite" },
    },
    data: { sendStatus: "skipped", error },
  });
  return result.count;
}

export async function markConnectedAndSkipInvites(contactId: string) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) return 0;
  if (contact.outreachStatus !== "messaged") {
    await prisma.contact.update({
      where: { id: contactId },
      data: { outreachStatus: "connected" },
    });
  }
  return skipQueuedInviteJobs(contactId);
}
