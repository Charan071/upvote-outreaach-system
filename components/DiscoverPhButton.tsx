"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconLabel } from "@/components/icons";

type Credits = {
  remaining: number | null;
  usedToday: number;
  dailyBudget: number;
};

type DiscoveryResult = {
  reused?: boolean;
  campaignId?: string | null;
  campaignName?: string | null;
  created?: number;
  skippedDuplicates?: number;
  creditsUsed?: number;
  credits?: Credits;
  error?: string;
};

export function DiscoverPhButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [names, setNames] = useState("");
  const [credits, setCredits] = useState<Credits | null>(null);
  const [result, setResult] = useState<DiscoveryResult | null>(null);

  useEffect(() => {
    fetch("/api/discover/product-hunt")
      .then((res) => res.json())
      .then((data) => {
        if (data.credits) setCredits(data.credits);
      })
      .catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/discover/product-hunt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productNames: names }),
    });
    const data = (await res.json()) as DiscoveryResult;
    setBusy(false);
    setResult(data);
    if (data.credits) setCredits(data.credits);
    router.refresh();
  }

  const remaining = credits?.remaining;
  const usedToday = credits?.usedToday ?? 0;
  const budget = credits?.dailyBudget ?? 1;

  return (
    <section className="panel import-form">
      <div>
        <p className="kicker">Daily collect · 1 credit</p>
        <h2>Find Product Hunt makers on LinkedIn</h2>
        <p className="muted">
          One Context.dev search returns up to 10 LinkedIn profiles. Names come from Unipile later
          (no extra Context.dev credits). Brand/extract calls are disabled. Daily budget: {budget}{" "}
          credit{budget === 1 ? "" : "s"}
          {remaining != null ? ` · ${remaining} remaining on the key` : ""}.
        </p>
      </div>
      <label htmlFor="ph-names" className="import-pane-label">
        Product names (optional, one per line, still 1 credit total)
      </label>
      <textarea
        id="ph-names"
        rows={4}
        value={names}
        onChange={(e) => setNames(e.target.value)}
        placeholder={"Cooper\nSpec\nPalo"}
      />
      <div className="import-actions">
        <button className="btn secondary" disabled={busy || usedToday >= budget} onClick={run} type="button">
          <IconLabel name="search">
            {busy ? "Searching…" : usedToday >= budget ? "Daily credit used" : "Collect makers"}
          </IconLabel>
        </button>
        {result?.error ? <p className="warn-text">{result.error}</p> : null}
        {result && !result.error ? (
          <p className="muted">
            {result.reused ? "Already collected today — 0 credits. " : ""}
            {result.created ?? 0} added, {result.skippedDuplicates ?? 0} already in the pool
            {result.reused ? "" : `, ${result.creditsUsed ?? 0} credit used`}.
            {result.campaignId ? (
              <>
                {" "}
                Review{" "}
                <Link href={`/campaigns/${result.campaignId}`}>
                  {result.campaignName || "today’s campaign"}
                </Link>
                .
              </>
            ) : null}
          </p>
        ) : null}
      </div>
    </section>
  );
}
