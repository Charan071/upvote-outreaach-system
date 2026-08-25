"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";

export function SyncInboxButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function sync() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/inbox/sync", { method: "POST" });
    const data = await res.json();
    setBusy(false);
    setMsg(data.error || `Synced ${data.imported ?? 0} inbound messages.`);
    router.refresh();
  }

  return (
    <div className="actions">
      <button className="btn" disabled={busy} onClick={sync} type="button">
        <IconLabel name="sync">{busy ? "Syncing…" : "Sync inbox"}</IconLabel>
      </button>
      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  );
}
