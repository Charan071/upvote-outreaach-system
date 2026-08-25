export type CopyTemplate = {
  id: string;
  label: string;
  body: string;
};

const MERIDIAN_PITCH =
  "We launched Meridian on Product Hunt! 🚀 It creates worklogs and daily summaries, so you can stop letting your work go unnoticed. It's open source and free for individual developers.";

const MERIDIAN_ASK = `I'd love your support and honest feedback:
https://www.producthunt.com/products/meridian-16`;

const MERIDIAN_NOTE = `${MERIDIAN_PITCH} ${MERIDIAN_ASK.replace(/\n/g, " ")}`;

export const INVITE_TEMPLATES: CopyTemplate[] = [
  {
    id: "hey-launch",
    label: "Hey + launch note",
    body: `Hey {first_name}, ${MERIDIAN_NOTE}`,
  },
  {
    id: "hi-launch",
    label: "Hi + launch note",
    body: `Hi {first_name}, ${MERIDIAN_NOTE}`,
  },
  {
    id: "name-launch",
    label: "Name + launch note",
    body: `{first_name}, ${MERIDIAN_NOTE}`,
  },
];

export const MESSAGE_TEMPLATES: CopyTemplate[] = [
  {
    id: "focused-launch",
    label: "Liked how focused it felt",
    body: `Hey {first_name},

I saw your {company} launch on Product Hunt and liked how focused it felt.

${MERIDIAN_PITCH}

${MERIDIAN_ASK}`,
  },
  {
    id: "useful-launch",
    label: "Genuinely useful",
    body: `Hey {first_name},

I saw your {company} launch on Product Hunt and liked it — the idea came across as genuinely useful.

${MERIDIAN_PITCH}

${MERIDIAN_ASK}`,
  },
  {
    id: "maker-first",
    label: "Maker-first launch",
    body: `Hey {first_name},

I liked what you shipped with {company} on Product Hunt. The launch felt maker-first, not noisy.

${MERIDIAN_PITCH}

${MERIDIAN_ASK}`,
  },
];

const DEFAULT_TEMPLATE = INVITE_TEMPLATES[0].body;

export type TemplateVars = {
  firstName?: string | null;
  company?: string | null;
};

export function contactTemplateVars(contact: {
  firstName?: string | null;
  company?: string | null;
  productName?: string | null;
}): TemplateVars {
  return {
    firstName: contact.firstName,
    company: (contact.productName || contact.company || "").trim() || null,
  };
}

export function defaultTemplate() {
  return DEFAULT_TEMPLATE;
}

export function templatesForKind(kind: "invite" | "message") {
  return kind === "message" ? MESSAGE_TEMPLATES : INVITE_TEMPLATES;
}

export function fillTemplate(template: string, vars: TemplateVars | string) {
  const fields = typeof vars === "string" ? { firstName: vars, company: null } : vars;
  const name = (fields.firstName ?? "").trim() || "there";
  const company = (fields.company ?? "").trim();
  let rendered = template.replaceAll("{first_name}", name).replaceAll("{company}", company);
  return rendered
    .replace(/[^\S\n]{2,}/g, " ")
    .replace(/[ \t]+([,!.])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function renderTemplate(template: string, vars: TemplateVars | string, max = 300) {
  return fillTemplate(template, vars).slice(0, max);
}

export function templateOverflow(template: string, vars: TemplateVars | string, max: number) {
  const length = fillTemplate(template, vars).length;
  if (length <= max) return null;
  return `This is ${length} characters after names are filled. The ${max} character cap would cut it mid-sentence.`;
}

export function assertInviteCopy(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bupvote/.test(lower) || /up-?vote/.test(lower)) {
    return "Invite notes cannot ask for upvotes.";
  }
  if (/return the favor|reciprocal|vote for (us|our)/.test(lower)) {
    return "Invite notes cannot ask for reciprocal voting.";
  }
  return null;
}
