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
  const max = kind === "message" ? 2000 : 300;
  const over = fillTemplate(value, { firstName: previewName, company: previewCompany }).length > max;

  async function save(applyToQueued: boolean) {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template: value, applyToQueued }),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.error || (applyToQueued ? `Updated ${data.updated} queued messages.` : "Template saved."));
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
        label="Campaign message"
      />
      <div className="row">
        <button className="btn secondary" disabled={busy || over} onClick={() => save(false)} type="button">
          <IconLabel name="save">Save template</IconLabel>
        </button>
        <button className="btn" disabled={busy || over} onClick={() => save(true)} type="button">
          <IconLabel name="apply">Apply to all queued</IconLabel>
        </button>
        {msg ? <p className="muted">{msg}</p> : null}
      </div>
    </section>
  );
}
