import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { armCampaign, getSettings } from "@/lib/queue";
import { deriveAccountHealth, startCampaignBlock, syncUnipileStatus } from "@/lib/health";
import { linkedInAccountConfigured } from "@/lib/unipile";
import {
  clampInviteDailyCap,
  clampMessageDailyCap,
  clampWeeklyInviteCap,
} from "@/lib/limits";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 });

  await syncUnipileStatus();
  const settings = await getSettings();
  const dailyCap = clampInviteDailyCap(settings.accountTier, settings.dailyCap);
  const weeklyInviteCap = clampWeeklyInviteCap(settings.accountTier, settings.weeklyInviteCap);
  const messageDailyCap = clampMessageDailyCap(settings.messageDailyCap);
  const { health } = deriveAccountHealth({
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

  const blocked = startCampaignBlock({
    health,
    paused: settings.paused,
    pausedReason: settings.pausedReason,
    kind: campaign.kind === "message" ? "message" : "invite",
    invitesToday: settings.invitesToday,
    dailyCap,
    invitesThisWeek: settings.invitesThisWeek,
    weeklyInviteCap,
    messagesToday: settings.messagesToday,
    messageDailyCap,
  });
  if (blocked) return NextResponse.json({ error: blocked }, { status: 400 });

  const { campaign: updated, scheduled } = await armCampaign(id);
  return NextResponse.json({ campaign: updated, scheduled });
}
