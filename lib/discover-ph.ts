import { prisma } from "./prisma";
import { getSettings } from "./queue";
import { normalizeLinkedInUrl } from "./linkedin";
import { contactTemplateVars, renderTemplate } from "./template";
import { isContextDevConfigured, searchWeb, type WebSearchHit } from "./context-dev";

export const DISCOVER_PRODUCT_CAP = 5;

const PH_STAFF = /founder of product hunt|ceo at product hunt|product hunt stanford|working at product hunt|investor at weekend fund/i;

export function utcDayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function parseProductNames(hits: WebSearchHit[]): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  for (const hit of hits) {
    const match = `${hit.title} ${hit.description}`.match(/^(.{2,48}?)\s+[-–—|]\s+Product Hunt/i);
    const name = match?.[1]?.replace(/\s+/g, " ").trim();
    if (!name || /product hunt|how to|guide|launch/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= DISCOVER_PRODUCT_CAP) break;
  }

  return names;
}

export function pickLinkedInFromHits(hits: WebSearchHit[], productName?: string) {
  const needle = productName?.toLowerCase();
  const ranked = [...hits].sort((a, b) => {
    if (!needle) return 0;
    const aHit = `${a.title} ${a.description}`.toLowerCase().includes(needle) ? 0 : 1;
    const bHit = `${b.title} ${b.description}`.toLowerCase().includes(needle) ? 0 : 1;
    return aHit - bHit;
  });

  for (const hit of ranked) {
    if (PH_STAFF.test(`${hit.title} ${hit.description}`)) continue;
    const normalized = normalizeLinkedInUrl(hit.url);
    if (normalized) {
      return {
        ...normalized,
        snippet: hit.description.slice(0, 400),
        title: hit.title,
        productHint: productHintFromHit(hit, productName),
      };
    }
  }
  return null;
}

function productHintFromHit(hit: WebSearchHit, fallback?: string) {
  if (fallback) return fallback;
  const at = `${hit.title} ${hit.description}`.match(/\b(?:at|@)\s+([^|•,\-]+)/i);
  const name = at?.[1]?.replace(/\s+/g, " ").trim();
  if (name && name.length >= 2 && name.length <= 48 && !/product hunt/i.test(name)) return name;
  return null;
}

export type DiscoveryProduct = {
  productName: string | null;
  linkedinUrl: string | null;
  status: "created" | "duplicate" | "no_linkedin";
};

export type DiscoveryResult = {
  reused: boolean;
  dayKey: string;
  campaignId: string | null;
  campaignName: string | null;
  productsFound: number;
  linkedinFound: number;
  created: number;
  skippedDuplicates: number;
  creditsUsed: number;
  products: DiscoveryProduct[];
};

export async function getTodaysDiscovery() {
  return prisma.discoveryRun.findUnique({ where: { dayKey: utcDayKey() } });
}

function parseNameList(input?: string) {
  if (!input?.trim()) return [];
  return [...new Set(input.split(/\n|,/).map((line) => line.trim()).filter((line) => line.length >= 2))].slice(
    0,
    DISCOVER_PRODUCT_CAP,
  );
}

export async function runDailyProductHuntDiscovery(opts?: { productNames?: string }): Promise<DiscoveryResult> {
  if (!isContextDevConfigured()) {
    throw new Error("Set CONTEXT_DEV_API_KEY to collect Product Hunt makers.");
  }

  const dayKey = utcDayKey();
  const named = parseNameList(opts?.productNames);
  const existing = await prisma.discoveryRun.findUnique({ where: { dayKey } });
  if (existing) {
    return {
      reused: true,
      dayKey,
      campaignId: existing.campaignId,
      campaignName: existing.campaignId
        ? (await prisma.campaign.findUnique({ where: { id: existing.campaignId } }))?.name ?? null
        : null,
      productsFound: existing.productsFound,
      linkedinFound: existing.linkedinFound,
      created: existing.created,
      skippedDuplicates: existing.skippedDuplicates,
      creditsUsed: existing.creditsUsed,
      products: existing.summary ? (JSON.parse(existing.summary) as DiscoveryProduct[]) : [],
    };
  }

  let creditsUsed = 0;
  const found: Array<{ productName: string | null; match: NonNullable<ReturnType<typeof pickLinkedInFromHits>> }> = [];

  if (named.length) {
    const profileSearch = await searchWeb(
      `${named.map((name) => `"${name}"`).join(" OR ")} (founder OR maker OR "co-founder") site:linkedin.com/in`,
      { numResults: 10, includeDomains: ["linkedin.com"] },
    );
    creditsUsed += 1;
    const seen = new Set<string>();
    for (const productName of named) {
      const match = pickLinkedInFromHits(profileSearch.results, productName);
      if (!match || seen.has(match.slug)) continue;
      seen.add(match.slug);
      found.push({ productName, match });
    }
  } else {
    const makerSearch = await searchWeb(
      'site:linkedin.com/in ("Product Hunt" maker OR "Product Hunt" hunter OR "launched on Product Hunt")',
      { numResults: 10, includeDomains: ["linkedin.com"] },
    );
    creditsUsed += 1;
    const seen = new Set<string>();
    for (const hit of makerSearch.results) {
      const match = pickLinkedInFromHits([hit]);
      if (!match || seen.has(match.slug)) continue;
      seen.add(match.slug);
      found.push({ productName: match.productHint, match });
      if (found.length >= DISCOVER_PRODUCT_CAP) break;
    }
  }

  const products: DiscoveryProduct[] = [];
  const createdIds: string[] = [];
  let linkedinFound = 0;
  let created = 0;
  let skippedDuplicates = 0;

  for (const item of found) {
    linkedinFound += 1;
    const duplicate = await prisma.contact.findFirst({
      where: { OR: [{ linkedinUrl: item.match.url }, { linkedinSlug: item.match.slug }] },
    });
    if (duplicate) {
      skippedDuplicates += 1;
      products.push({ productName: item.productName, linkedinUrl: item.match.url, status: "duplicate" });
      continue;
    }

    const contact = await prisma.contact.create({
      data: {
        linkedinUrl: item.match.url,
        linkedinSlug: item.match.slug,
        company: item.productName,
        productName: item.productName,
        contextSnippet: item.match.snippet,
        source: "product_hunt",
        enrichStatus: "pending",
        outreachStatus: "never",
      },
    });
    created += 1;
    createdIds.push(contact.id);
    products.push({ productName: item.productName, linkedinUrl: item.match.url, status: "created" });
  }

  if (named.length) {
    for (const productName of named) {
      if (!products.some((row) => row.productName === productName)) {
        products.push({ productName, linkedinUrl: null, status: "no_linkedin" });
      }
    }
  }

  let campaignId: string | null = null;
  let campaignName: string | null = null;
  if (createdIds.length) {
    const settings = await getSettings();
    const createdProducts = products.filter((item) => item.status === "created");
    campaignName = `PH makers — ${dayKey}`;
    const campaign = await prisma.campaign.create({
      data: {
        name: campaignName,
        kind: "invite",
        status: "draft",
        template: settings.defaultTemplate,
        contacts: {
          create: createdIds.map((contactId, index) => ({
            contactId,
            renderedMessage: renderTemplate(
              settings.defaultTemplate,
              contactTemplateVars({
                firstName: null,
                productName: createdProducts[index]?.productName ?? null,
              }),
              300,
            ),
            sendStatus: "queued",
            runAfter: new Date(Date.now() + index * 1000),
          })),
        },
      },
    });
    campaignId = campaign.id;
    await prisma.contact.updateMany({
      where: { id: { in: createdIds } },
      data: { lastCampaignId: campaign.id, outreachStatus: "queued" },
    });
  }

  if (found.length || created) {
    await prisma.discoveryRun.create({
      data: {
        dayKey,
        campaignId,
        productsFound: found.length,
        linkedinFound,
        created,
        skippedDuplicates,
        creditsUsed,
        summary: JSON.stringify(products),
      },
    });
  }

  return {
    reused: false,
    dayKey,
    campaignId,
    campaignName,
    productsFound: found.length,
    linkedinFound,
    created,
    skippedDuplicates,
    creditsUsed,
    products,
  };
}
