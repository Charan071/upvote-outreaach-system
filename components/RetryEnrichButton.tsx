"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";

export function RetryEnrichButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    await fetch(`/api/contacts/${id}/enrich`, { method: "POST" });
    setBusy(false);
    router.refresh();
  }

  return (
    <button className="btn secondary" disabled={busy} onClick={retry} type="button">
      <IconLabel name="sync">{busy ? "Retrying…" : "Retry enrich"}</IconLabel>
    </button>
  );
}
