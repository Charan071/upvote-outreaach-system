"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";
import { REVIEW_LABELS } from "@/lib/status";

export function ReviewActions({
  messageId,
  aiLabel,
}: {
  messageId: string;
  aiLabel?: string | null;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(aiLabel && REVIEW_LABELS.some((item) => item.value === aiLabel) ? aiLabel : "unclear");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/review/${messageId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    router.refresh();
  }

  return (
    <div className="review-actions">
      <select value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Reply label">
        {REVIEW_LABELS.map((item) => (
          <option key={item.value} value={item.value}>
            {item.label}
          </option>
        ))}
      </select>
      <button className="btn" disabled={busy} onClick={submit} type="button">
        <IconLabel name="check">{busy ? "Saving…" : "Save and remove"}</IconLabel>
      </button>
      {error ? <p className="warn-text">{error}</p> : null}
    </div>
  );
}
