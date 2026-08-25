"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel, type IconName } from "@/components/icons";

export function tickReasonMessage(data: Record<string, unknown>) {
  const reason = String(data.reason || "");
  if (reason === "jitter") return "Waiting a random gap so this does not look like a bot.";
  if (reason === "outside_hours") {
    return "Invites wait for working hours (9:00–18:00). Name lookups can still run.";
  }
  if (reason === "daily_cap") return "Daily LinkedIn cap reached.";
  if (reason === "weekly_cap") return "Weekly invite cap reached.";
  if (reason === "paused") return String(data.detail || "Sending is paused.");
  if (reason === "disconnected") return String(data.detail || "LinkedIn is disconnected in Unipile.");
  if (reason === "sent") return "Connection request sent. The next one waits a random interval.";
  if (reason === "enriched") return "Looked up one profile. The next visit waits a random interval.";
  if (reason === "empty") return "Nothing is due right now.";
  if (data.error) return String(data.error);
  return null;
}

export function QueueTickButton({
  label = "Run next action",
  icon = "send",
  primary = false,
}: {
  label?: string;
  icon?: IconName;
  primary?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/queue/tick", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(tickReasonMessage(data));
    router.refresh();
  }

  return (
    <div className="actions">
      <button className={primary ? "btn" : "btn secondary"} disabled={busy} onClick={run} type="button">
        <IconLabel name={icon}>{busy ? "Working…" : label}</IconLabel>
      </button>
      {msg ? <p className="muted">{msg}</p> : null}
    </div>
  );
}
