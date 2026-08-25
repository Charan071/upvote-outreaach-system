"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";

export function QueuedMessageEditor({
  campaignId,
  rowId,
  initial,
  locked,
  kind = "invite",
}: {
  campaignId: string;
  rowId: string;
  initial: string;
  locked: boolean;
  kind?: "invite" | "message";
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const max = kind === "message" ? 2000 : 300;
  const over = value.length > max;

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/messages/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ renderedMessage: value }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save");
      return;
    }
    router.refresh();
  }

  if (locked) return <p className="queued-note-locked">{initial}</p>;

  return (
    <div className="stack">
      <textarea
        className="queued-note"
        rows={8}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className={over ? "warn-text" : "muted"}>
        {value.length}/{max}
        {over ? " — too long; LinkedIn would cut this mid-sentence." : ""}
      </p>
      <button className="btn secondary" disabled={busy || over || value === initial} onClick={save} type="button">
        <IconLabel name="save">{busy ? "Saving…" : "Save"}</IconLabel>
      </button>
      {error ? <p className="warn-text">{error}</p> : null}
    </div>
  );
}
