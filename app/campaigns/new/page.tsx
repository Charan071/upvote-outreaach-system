"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MessageComposer } from "@/components/MessageComposer";
import { IconLabel } from "@/components/icons";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"invite" | "message">("invite");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.settings?.defaultTemplate) setTemplate(data.settings.defaultTemplate);
      });
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind, template }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create campaign");
      return;
    }
    router.push(`/campaigns/${data.campaign.id}`);
  }

  return (
    <form onSubmit={onSubmit} className="panel stack" style={{ maxWidth: 720 }}>
      <p className="kicker">New campaign</p>
      <h1>Write the invite, then send</h1>
      <p className="muted">
        This queues connection requests to people who are already looked up. After you save, press Start sending, then Send next invite.
      </p>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as "invite" | "message")}>
          <option value="invite">Invite (never contacted)</option>
          <option value="message">Message (positive pool only)</option>
        </select>
      </label>
      <MessageComposer kind={kind} value={template} onChange={setTemplate} />
      <button className="btn" disabled={busy} type="submit">
        <IconLabel name="send">{busy ? "Saving…" : "Save note and continue"}</IconLabel>
      </button>
      {error ? <p className="muted">{error}</p> : null}
    </form>
  );
}
