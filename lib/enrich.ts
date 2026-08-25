import { prisma } from "./prisma";
import { getLinkedInProfile, isLinkedInLimitError } from "./unipile";
import { contactTemplateVars, renderTemplate } from "./template";
import { companyFromHeadline } from "./context-dev";
import { recordLinkedInFailure } from "./health";
import { isFirstDegreeProfile, skipQueuedInviteJobs } from "./connected";

export async function enrichContact(contactId: string, opts?: { countVisit?: boolean }) {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new Error("Contact not found");

  if (opts?.countVisit !== false) {
    const settings = await prisma.settings.findUnique({ where: { id: "default" } });
    if (settings && settings.profilesToday >= settings.profileDailyCap) {
      throw new Error("Daily LinkedIn profile-visit cap reached (~100/day Unipile recommendation).");
    }
  }

  await prisma.contact.update({
    where: { id: contactId },
    data: { enrichStatus: "pending", enrichError: null },
  });

  try {
    const profile = await getLinkedInProfile(contact.linkedinSlug);
    const companyGuess = companyFromHeadline(profile.headline);
    const publicContext = {
      company: companyGuess ?? contact.productName,
      companyDomain: null as string | null,
      snippet: contact.contextSnippet,
    };

    if (opts?.countVisit !== false) {
      await prisma.settings.update({
        where: { id: "default" },
        data: { profilesToday: { increment: 1 } },
      });
    }

    const alreadyConnected =
      isFirstDegreeProfile(profile) && contact.outreachStatus !== "messaged";
    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        headline: profile.headline,
        company: publicContext.company,
        companyDomain: contact.companyDomain,
        contextSnippet: publicContext.snippet,
        unipileProviderId: profile.providerId,
        linkedinSlug: profile.publicIdentifier || contact.linkedinSlug,
        enrichStatus: "ready",
        enrichError: null,
        ...(alreadyConnected ? { outreachStatus: "connected" } : {}),
      },
    });
    if (isFirstDegreeProfile(profile)) {
      await skipQueuedInviteJobs(updated.id);
    }
    await refreshDraftCampaignCopy(updated);
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enrich failed";
    if (isLinkedInLimitError(error)) {
      await recordLinkedInFailure(error, {
        pause: true,
        pausedReason: "LinkedIn profile-visit limit (429/500). Enrichment paused.",
      });
    } else {
      await recordLinkedInFailure(error);
    }
    return prisma.contact.update({
      where: { id: contactId },
      data: { enrichStatus: "failed", enrichError: message },
    });
  }
}

async function refreshDraftCampaignCopy(contact: {
  id: string;
  firstName: string | null;
  company: string | null;
  productName: string | null;
}) {
  const rows = await prisma.campaignContact.findMany({
    where: { contactId: contact.id, sendStatus: "queued", campaign: { status: "draft" } },
    include: { campaign: true },
  });
  for (const row of rows) {
    await prisma.campaignContact.update({
      where: { id: row.id },
      data: {
        renderedMessage: renderTemplate(
          row.campaign.template,
          contactTemplateVars(contact),
          row.campaign.kind === "message" ? 2000 : 300,
        ),
      },
    });
  }
}
