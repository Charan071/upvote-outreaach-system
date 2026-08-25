"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FormattedNotePreview, MessageComposer } from "@/components/MessageComposer";
import { IconLabel } from "@/components/icons";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"invite" | "message">("invite");
  const [template, setTemplate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

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
      body: JSON.stringify({ name: name.trim() || undefined, kind, template }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not create campaign");
      return;
    }
    router.push(`/campaigns/${data.campaign.id}`);
  }

  const title = kind === "message" ? "Write the follow-up message" : "Write the invite";
  const submitLabel = kind === "message" ? "Queue messages" : "Queue invites";

  return (
    <form onSubmit={onSubmit} className="panel stack form-narrow">
      <p className="kicker">New campaign</p>
      <h1>{title}</h1>
      <p className="muted">
        One note for everyone in this campaign. The worker sends one {kind === "message" ? "message" : "invite"} at a
        time during working hours, with the gap set in Settings.
      </p>
      <label>
        Name <span className="muted">(optional)</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={kind === "message" ? "Messages · today" : "Invites · today"}
        />
      </label>
      <label>
        Kind
        <select value={kind} onChange={(e) => setKind(e.target.value as "invite" | "message")}>
          <option value="invite">Connection invites (not contacted yet)</option>
          <option value="message">Follow-up messages (interested pool)</option>
        </select>
      </label>
      <MessageComposer kind={kind} value={template} onChange={setTemplate} label="Note" />
      <div className="row">
        <button className="btn" disabled={busy} type="submit">
          <IconLabel name="send">{busy ? "Queueing…" : submitLabel}</IconLabel>
        </button>
        <button
          className="btn secondary"
          aria-expanded={previewOpen}
          onClick={() => setPreviewOpen((open) => !open)}
          type="button"
        >
          <IconLabel name="preview">{previewOpen ? "Hide preview" : "Preview"}</IconLabel>
        </button>
      </div>
      {previewOpen ? <FormattedNotePreview kind={kind} value={template} /> : null}
      {error ? <p className="warn-text">{error}</p> : null}
    </form>
  );
}
