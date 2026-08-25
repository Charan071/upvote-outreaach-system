"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LABELS } from "@/lib/gemini";
import { IconLabel } from "@/components/icons";

export function ReviewActions({ id, aiLabel }: { id: string; aiLabel: string }) {
  const router = useRouter();
  const [label, setLabel] = useState(aiLabel);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    await fetch(`/api/review/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="review-actions">
      <select value={label} onChange={(e) => setLabel(e.target.value)}>
        {LABELS.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
      <button className="btn" disabled={busy} onClick={submit} type="button">
        <IconLabel name="check">{busy ? "Saving…" : "Confirm"}</IconLabel>
      </button>
    </div>
  );
}
