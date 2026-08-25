const SLUG_PATH = /^\/in\/([^/]+)/i;
const IN_HREF = /linkedin\.com\/in\/([^/?#]+)/i;

export type NormalizedLinkedIn = {
  slug: string;
  url: string;
};

export function normalizeLinkedInUrl(input: string): NormalizedLinkedIn | null {
  const raw = input.trim();
  if (!raw) return null;

  let value = raw;
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, "")}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host !== "linkedin.com" && host !== "linkedin.cn" && !host.endsWith(".linkedin.com")) return null;

  const match = parsed.pathname.match(SLUG_PATH) ?? value.match(IN_HREF);
  if (!match) return null;

  const slug = decodeURIComponent(match[1]).replace(/\/+$/, "").split("/")[0];
  if (!slug) return null;

  return {
    slug,
    url: `https://www.linkedin.com/in/${slug}`,
  };
}

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value)) rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") {
      cell += ch;
    }
  }
  row.push(cell.trim());
  if (row.some((value) => value)) rows.push(row);
  return rows;
}

export function extractLinkedInUrls(text: string): string[] {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];

  const header = rows[0];
  const headerLooksLikeUrls = header.some((cell) => Boolean(normalizeLinkedInUrl(cell)));
  let urlCol = -1;
  if (!headerLooksLikeUrls) {
    urlCol = header.findIndex((cell) => /linkedin|profile|^url$/i.test(cell));
  }

  const start = urlCol >= 0 ? 1 : 0;
  const seen = new Set<string>();
  const urls: string[] = [];

  for (let i = start; i < rows.length; i++) {
    const cells = urlCol >= 0 ? [rows[i][urlCol] ?? ""] : rows[i];
    for (const cell of cells) {
      const normalized = normalizeLinkedInUrl(cell);
      if (normalized && !seen.has(normalized.url)) {
        seen.add(normalized.url);
        urls.push(normalized.url);
      }
    }
  }
  return urls;
}

export function parseLinkedInInput(text: string): string[] {
  return extractLinkedInUrls(text);
}
