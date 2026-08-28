export const REVIEW_LABELS = [
  { value: "positive", label: "Interested" },
  { value: "question", label: "Question" },
  { value: "decline", label: "Not interested" },
  { value: "wrong_person", label: "Wrong person" },
  { value: "ooo", label: "Out of office" },
  { value: "stop", label: "Do not contact" },
  { value: "unclear", label: "Unclear" },
] as const;

const LABELS: Record<string, string> = {
  pending: "Needs name",
  ready: "Ready",
  failed: "Failed",
  enrich_failed: "Lookup failed",
  never: "Not contacted",
  queued: "Queued",
  sending: "Sending",
  invited: "Invited",
  connected: "Connected",
  messaged: "Messaged",
  replied: "Replied",
  sent: "Sent",
  skipped: "Skipped",
  none: "—",
  pending_review: "Needs review",
  positive: "Interested",
  excluded: "Excluded",
  draft: "Draft",
  running: "Sending",
  paused: "Paused",
  completed: "Done",
  invite: "Connection invites",
  message: "Follow-up messages",
  question: "Question",
  decline: "Not interested",
  wrong_person: "Wrong person",
  ooo: "Out of office",
  stop: "Do not contact",
  unclear: "Unclear",
};

export function statusLabel(status: string) {
  return LABELS[status] ?? status.replaceAll("_", " ");
}

export function campaignKindLabel(kind: string) {
  return kind === "message" ? LABELS.message : LABELS.invite;
}

export function contactStatus(contact: {
  enrichStatus: string;
  outreachStatus: string;
  poolStatus: string;
}) {
  if (contact.enrichStatus === "failed") return "enrich_failed";
  if (contact.enrichStatus === "pending") return "pending";
  if (contact.poolStatus === "pending_review") return "pending_review";
  if (contact.poolStatus === "excluded") return "excluded";
  if (contact.poolStatus === "positive") return "positive";
  if (contact.outreachStatus === "connected") return "connected";
  if (contact.outreachStatus === "messaged") return "messaged";
  if (contact.outreachStatus === "invited") return "invited";
  if (contact.outreachStatus === "queued") return "queued";
  if (contact.enrichStatus === "ready") return "ready";
  return "never";
}

export function reviewLabel(status: string) {
  return REVIEW_LABELS.find((item) => item.value === status)?.label ?? statusLabel(status);
}
