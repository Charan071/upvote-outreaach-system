"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";

export function CampaignActions({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function startOrPause(path: string) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(path, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMsg(data.error || "Could not update campaign");
      return;
    }
    setMsg(path.endsWith("/pause") ? "Paused. The worker will not send from this campaign." : "The worker will send one invite at a time during working hours.");
    router.refresh();
  }

  return (
    <div className="actions">
      {status !== "running" ? (
        <button className="btn" disabled={busy} onClick={() => startOrPause(`/api/campaigns/${id}/start`)} type="button">
          <IconLabel name="play">{busy ? "Starting…" : "Resume"}</IconLabel>
        </button>
      ) : (
        <button className="btn secondary" disabled={busy} onClick={() => startOrPause(`/api/campaigns/${id}/pause`)} type="button">
          <IconLabel name="pause">Pause</IconLabel>
        </button>
      )}
      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  );
}
