import { GoogleGenerativeAI } from "@google/generative-ai";

export const LABELS = [
  "positive",
  "question",
  "decline",
  "wrong_person",
  "ooo",
  "stop",
  "unclear",
] as const;

export type ReplyLabel = (typeof LABELS)[number];

export async function classifyReply(body: string): Promise<{
  label: ReplyLabel;
  confidence: number;
  reason: string;
  model: string;
} | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;

  const modelName = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  const prompt = `Classify this LinkedIn reply. Return JSON only:
{"label": one of ${LABELS.join("|")}, "confidence": 0-1 number, "reason": short string}

positive = interested, happy to help, wants to talk, warm accept
question = asks what this is / wants more info
decline = not interested
wrong_person = not the intended person
ooo = out of office / auto-reply
stop = unsubscribe / do not contact
unclear = cannot tell

Reply:
"""${body.slice(0, 4000)}"""`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const parsed = JSON.parse(text) as { label?: string; confidence?: number; reason?: string };
  const label = LABELS.includes(parsed.label as ReplyLabel)
    ? (parsed.label as ReplyLabel)
    : "unclear";

  return {
    label,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
    reason: parsed.reason ?? "",
    model: modelName,
  };
}
