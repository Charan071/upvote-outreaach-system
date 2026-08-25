"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon, IconLabel } from "@/components/icons";

export function ImportForm({
  pendingCount = 0,
  readyCount = 0,
}: {
  pendingCount?: number;
  readyCount?: number;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [imported, setImported] = useState(false);

  async function onFile(file: File | null) {
    if (!file) {
      setFileName(null);
      setFileText("");
      return;
    }
    setFileName(file.name);
    setFileText(await file.text());
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = [fileText, text].filter(Boolean).join("\n");
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(
        `Added ${data.created}. Skipped ${data.skippedDuplicates} duplicates. ${data.pendingEnrich ?? 0} waiting for a name lookup.`,
      );
      setImported(data.created > 0);
      setText("");
      setFileName(null);
      setFileText("");
      setFileKey((n) => n + 1);
      router.refresh();
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(text.trim() || fileText.trim());

  return (
    <form onSubmit={onSubmit} className="panel import-form">
      <div>
        <p className="kicker">Step 1</p>
        <h2>Add LinkedIn profiles</h2>
        <p className="muted">CSV or pasted URLs. The worker looks up first names one profile at a time.</p>
      </div>
      <div className="import-grid">
        <div className="import-pane">
          <p className="import-pane-label">CSV file</p>
          <input
            id="csv"
            key={fileKey}
            className="sr-only"
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          <label htmlFor="csv" className="btn secondary file-btn">
            <Icon name="upload" size={16} />
            {fileName ? "Replace CSV" : "Choose CSV"}
          </label>
          <p className="muted">{fileName ? fileName : "Use a linkedin_url column, or one URL per cell."}</p>
        </div>
        <div className="import-or" aria-hidden>
          or
        </div>
        <div className="import-pane">
          <label htmlFor="urls" className="import-pane-label">Paste URLs</label>
          <textarea
            id="urls"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"https://www.linkedin.com/in/example"}
            rows={5}
          />
        </div>
      </div>
      <div className="import-actions">
        <button className="btn" disabled={busy || !canSubmit} type="submit">
          <IconLabel name="plus">{busy ? "Importing…" : "Add to pool"}</IconLabel>
        </button>
        {result ? <p className="muted">{result}</p> : null}
      </div>
      {imported || pendingCount > 0 || readyCount > 0 ? (
        <p className="muted import-hint">
          Next: look up names, then write the invite and send connection requests.
        </p>
      ) : null}
    </form>
  );
}
