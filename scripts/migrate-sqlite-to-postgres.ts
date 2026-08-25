import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const sqlitePath = process.env.SQLITE_PATH || path.join(process.cwd(), "prisma/dev.db");

function table<T>(name: string): T[] {
  const raw = execFileSync("sqlite3", ["-json", sqlitePath, `SELECT * FROM "${name}"`], {
    encoding: "utf8",
  }).trim();
  return raw ? (JSON.parse(raw) as T[]) : [];
}

function dt(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return new Date(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return new Date(Number(value));
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function requiredDate(value: unknown) {
  return dt(value) ?? new Date();
}

function bool(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function int(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

async function main() {
  if (!existsSync(sqlitePath)) {
    throw new Error(`SQLite database not found at ${sqlitePath}`);
  }
  if (!process.env.DATABASE_URL?.startsWith("postgres")) {
    throw new Error("DATABASE_URL must be a Postgres connection string");
  }

  const prisma = new PrismaClient();
  const existing = await prisma.contact.count();
  if (existing > 0) {
    console.info(`Postgres already has ${existing} contacts; skipping copy.`);
    await prisma.$disconnect();
    return;
  }

  const settings = table<Record<string, unknown>>("Settings");
  const contacts = table<Record<string, unknown>>("Contact");
  const campaigns = table<Record<string, unknown>>("Campaign");
  const campaignContacts = table<Record<string, unknown>>("CampaignContact");
  const messages = table<Record<string, unknown>>("Message");
  const classifications = table<Record<string, unknown>>("Classification");
  const discovery = table<Record<string, unknown>>("DiscoveryRun");

  for (const row of settings) {
    await prisma.settings.upsert({
      where: { id: String(row.id) },
      update: {},
      create: {
        id: String(row.id),
        paused: bool(row.paused),
        pausedReason: row.pausedReason ? String(row.pausedReason) : null,
        accountTier: String(row.accountTier ?? "paid"),
        timezone: String(row.timezone ?? "Asia/Kolkata"),
        workStartHour: int(row.workStartHour, 9),
        workEndHour: int(row.workEndHour, 18),
        workDays: String(row.workDays ?? "1,2,3,4,5"),
        dailyCap: int(row.dailyCap, 15),
        messageDailyCap: int(row.messageDailyCap, 20),
        profileDailyCap: int(row.profileDailyCap, 40),
        weeklyInviteCap: int(row.weeklyInviteCap, 80),
        sentToday: int(row.sentToday),
        invitesToday: int(row.invitesToday),
        messagesToday: int(row.messagesToday),
        profilesToday: int(row.profilesToday),
        invitesThisWeek: int(row.invitesThisWeek),
        windowStart: requiredDate(row.windowStart),
        weekStart: requiredDate(row.weekStart),
        nextAllowedAt: requiredDate(row.nextAllowedAt),
        lastActionAt: dt(row.lastActionAt),
        defaultTemplate: String(row.defaultTemplate ?? ""),
        minJitterSec: int(row.minJitterSec, 480),
        maxJitterSec: int(row.maxJitterSec, 1500),
        contextCreditsRemaining: row.contextCreditsRemaining == null ? null : int(row.contextCreditsRemaining),
        contextCreditsUsedToday: int(row.contextCreditsUsedToday),
        unipileStatus: row.unipileStatus ? String(row.unipileStatus) : null,
        lastSyncAt: dt(row.lastSyncAt),
        lastError: row.lastError ? String(row.lastError) : null,
        consecutiveFailures: int(row.consecutiveFailures),
      },
    });
  }

  if (contacts.length) {
    await prisma.contact.createMany({
      data: contacts.map((row) => ({
        id: String(row.id),
        linkedinUrl: String(row.linkedinUrl),
        linkedinSlug: String(row.linkedinSlug),
        firstName: row.firstName ? String(row.firstName) : null,
        lastName: row.lastName ? String(row.lastName) : null,
        headline: row.headline ? String(row.headline) : null,
        company: row.company ? String(row.company) : null,
        companyDomain: row.companyDomain ? String(row.companyDomain) : null,
        contextSnippet: row.contextSnippet ? String(row.contextSnippet) : null,
        unipileProviderId: row.unipileProviderId ? String(row.unipileProviderId) : null,
        enrichStatus: String(row.enrichStatus ?? "pending"),
        enrichError: row.enrichError ? String(row.enrichError) : null,
        outreachStatus: String(row.outreachStatus ?? "never"),
        poolStatus: String(row.poolStatus ?? "none"),
        lastCampaignId: row.lastCampaignId ? String(row.lastCampaignId) : null,
        lastOutboundAt: dt(row.lastOutboundAt),
        productName: row.productName ? String(row.productName) : null,
        source: String(row.source ?? "manual"),
        createdAt: requiredDate(row.createdAt),
        updatedAt: requiredDate(row.updatedAt),
      })),
    });
  }

  if (campaigns.length) {
    await prisma.campaign.createMany({
      data: campaigns.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        kind: String(row.kind),
        template: String(row.template),
        status: String(row.status ?? "draft"),
        dailyCap: int(row.dailyCap, 15),
        createdAt: requiredDate(row.createdAt),
        updatedAt: requiredDate(row.updatedAt),
      })),
    });
  }

  if (campaignContacts.length) {
    await prisma.campaignContact.createMany({
      data: campaignContacts.map((row) => ({
        id: String(row.id),
        campaignId: String(row.campaignId),
        contactId: String(row.contactId),
        renderedMessage: String(row.renderedMessage),
        sendStatus: String(row.sendStatus ?? "queued"),
        runAfter: requiredDate(row.runAfter),
        sentAt: dt(row.sentAt),
        error: row.error ? String(row.error) : null,
        unipileId: row.unipileId ? String(row.unipileId) : null,
      })),
    });
  }

  if (messages.length) {
    await prisma.message.createMany({
      data: messages.map((row) => ({
        id: String(row.id),
        contactId: String(row.contactId),
        direction: String(row.direction),
        body: String(row.body),
        unipileMessageId: row.unipileMessageId ? String(row.unipileMessageId) : null,
        receivedAt: requiredDate(row.receivedAt),
      })),
    });
  }

  if (classifications.length) {
    await prisma.classification.createMany({
      data: classifications.map((row) => ({
        id: String(row.id),
        messageId: String(row.messageId),
        aiLabel: String(row.aiLabel),
        aiConfidence: row.aiConfidence == null ? null : Number(row.aiConfidence),
        aiReason: row.aiReason ? String(row.aiReason) : null,
        model: String(row.model),
        humanLabel: row.humanLabel ? String(row.humanLabel) : null,
        reviewedAt: dt(row.reviewedAt),
      })),
    });
  }

  if (discovery.length) {
    await prisma.discoveryRun.createMany({
      data: discovery.map((row) => ({
        id: String(row.id),
        dayKey: String(row.dayKey),
        campaignId: row.campaignId ? String(row.campaignId) : null,
        productsFound: int(row.productsFound),
        linkedinFound: int(row.linkedinFound),
        created: int(row.created),
        skippedDuplicates: int(row.skippedDuplicates),
        creditsUsed: int(row.creditsUsed),
        summary: row.summary ? String(row.summary) : null,
        createdAt: requiredDate(row.createdAt),
      })),
    });
  }

  console.info(
    `Copied ${contacts.length} contacts, ${campaigns.length} campaigns, ${campaignContacts.length} queue rows from SQLite.`,
  );
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
