"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";
import { QueueTickButton } from "@/components/QueueTickButton";

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
    if (data.error) setMsg(data.error);
    else if (path.endsWith("/start")) setMsg("Sending is armed. Use Send next invite to send one connection request.");
    router.refresh();
  }

  return (
    <div className="actions">
      {status !== "running" ? (
        <button className="btn" disabled={busy} onClick={() => startOrPause(`/api/campaigns/${id}/start`)} type="button">
          <IconLabel name="play">{busy ? "Starting…" : "Start sending"}</IconLabel>
        </button>
      ) : (
        <button className="btn secondary" disabled={busy} onClick={() => startOrPause(`/api/campaigns/${id}/pause`)} type="button">
          <IconLabel name="pause">Pause</IconLabel>
        </button>
      )}
      <QueueTickButton label="Send next invite" icon="send" primary={status === "running"} />
      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  );
}
