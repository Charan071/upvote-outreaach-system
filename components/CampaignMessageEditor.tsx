"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MessageComposer } from "@/components/MessageComposer";
import { IconLabel } from "@/components/icons";
import { fillTemplate } from "@/lib/template";

export function CampaignMessageEditor({
  campaignId,
  kind,
  template,
  previewName,
  previewCompany,
}: {
  campaignId: string;
  kind: "invite" | "message";
  template: string;
  previewName: string;
  previewCompany?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(template);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const max = kind === "message" ? 2000 : 300;
  const over = fillTemplate(value, { firstName: previewName, company: previewCompany }).length > max;

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: value }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setErr(data.error || "Could not save");
      return;
    }
    setMsg(`Saved. Updated ${data.updated ?? 0} queued notes.`);
    router.refresh();
  }

  return (
    <section className="panel stack">
      <MessageComposer
        kind={kind}
        value={value}
        onChange={setValue}
        previewName={previewName}
        previewCompany={previewCompany}
        label="Invite note"
      />
      <div className="row">
        <button className="btn" disabled={busy || over} onClick={save} type="button">
          <IconLabel name="save">{busy ? "Saving…" : "Save note"}</IconLabel>
        </button>
        {err ? <p className="warn-text">{err}</p> : null}
        {msg ? <p className="muted">{msg}</p> : null}
      </div>
    </section>
  );
}
