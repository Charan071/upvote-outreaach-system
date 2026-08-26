"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconLabel } from "@/components/icons";

type CampaignOption = {
  id: string;
  name: string;
  kind: string;
  status: string;
  _count?: { contacts: number };
};

export function ReadyInviteActions({ readyCount }: { readyCount: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/campaigns")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = (data.campaigns || []) as CampaignOption[];
        setCampaigns(
          rows.filter(
            (c) =>
              c.kind === "invite" &&
              (c.status === "running" || c.status === "paused" || c.status === "draft"),
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setCampaigns([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (readyCount <= 0) return null;

  async function addToCampaign(campaignId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/campaigns/${campaignId}/add-contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not add contacts");
      return;
    }
    setOpen(false);
    router.push(`/campaigns/${campaignId}`);
    router.refresh();
  }

  return (
    <div className="ready-invite-actions">
      <div className="actions">
        <button className="btn" disabled={busy} onClick={() => setOpen((v) => !v)} type="button">
          <IconLabel name="send">
            {open ? "Close" : `Invite ${readyCount} ready`}
          </IconLabel>
        </button>
        <Link className="btn secondary" href="/campaigns/new">
          <IconLabel name="send">New campaign</IconLabel>
        </Link>
      </div>
      {open ? (
        <div className="ready-invite-menu panel stack">
          <p className="muted">
            Add all {readyCount} ready people to an existing invite campaign, or start a new one.
          </p>
          {campaigns.length === 0 ? (
            <p className="muted">No open invite campaigns yet.</p>
          ) : (
            <ul className="ready-invite-list">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <button
                    className="btn-link"
                    disabled={busy}
                    onClick={() => addToCampaign(campaign.id)}
                    type="button"
                  >
                    Add to {campaign.name}
                    <span className="muted">
                      {" "}
                      · {campaign.status}
                      {campaign._count?.contacts != null ? ` · ${campaign._count.contacts} people` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link className="btn secondary" href="/campaigns/new">
            New campaign instead
          </Link>
          {error ? <p className="warn-text">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
