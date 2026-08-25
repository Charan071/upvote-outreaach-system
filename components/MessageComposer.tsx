"use client";

import { useId } from "react";
import { IconLabel } from "@/components/icons";
import { assertInviteCopy, fillTemplate, templatesForKind } from "@/lib/template";

export function MessageComposer({
  value,
  onChange,
  kind = "invite",
  previewName = "Alex",
  previewCompany = "Acme",
  label = "Message",
  noteMax,
}: {
  value: string;
  onChange: (value: string) => void;
  kind?: "invite" | "message";
  previewName?: string;
  previewCompany?: string;
  label?: string;
  noteMax?: number;
}) {
  const fieldId = useId();
  const max = kind === "invite" ? (noteMax ?? 300) : 2000;
  const filled = fillTemplate(value, { firstName: previewName, company: previewCompany });
  const copyError = kind === "invite" ? assertInviteCopy(value) : null;
  const over = filled.length > max;
  const presets = templatesForKind(kind);

  function insertToken() {
    if (value.includes("{first_name}")) return;
    onChange(value.trim() ? `Hey {first_name}, ${value.trim()}` : "Hey {first_name}, ");
  }

  function insertCompany() {
    if (value.includes("{company}")) return;
    onChange(value.trim() ? `${value.trim()} at {company}` : "Hey {first_name}, I saw your work at {company}.");
  }

  return (
    <div className="composer">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <label htmlFor={fieldId}>{label}</label>
        <div className="actions">
          <select
            aria-label="Use a template"
            className="template-pick"
            onChange={(e) => {
              const next = presets.find((item) => item.id === e.target.value);
              if (next) onChange(next.body);
              e.currentTarget.value = "";
            }}
            value=""
          >
            <option value="">Use a template…</option>
            {presets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <button className="btn secondary" onClick={insertToken} type="button">
            <IconLabel name="user">Insert first name</IconLabel>
          </button>
          <button className="btn secondary" onClick={insertCompany} type="button">
            <IconLabel name="building">Insert company</IconLabel>
          </button>
        </div>
      </div>
      <textarea
        id={fieldId}
        rows={6}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Hey {first_name}, I saw your work at {company}…"
      />
      <p className={over ? "warn-text" : "muted"}>
        {filled.length}/{max} characters after tokens are filled.
        {kind === "invite" ? " LinkedIn invite notes cap at 300." : null}
      </p>
      {copyError ? <p className="warn-text">{copyError}</p> : null}
      {over ? (
        <p className="warn-text">
          This is too long. LinkedIn would cut it mid-sentence. Shorten it before saving.
        </p>
      ) : null}
    </div>
  );
}

export function FormattedNotePreview({
  value,
  previewName = "Alex",
  previewCompany = "Acme",
  kind = "invite",
  noteMax,
}: {
  value: string;
  previewName?: string;
  previewCompany?: string;
  kind?: "invite" | "message";
  noteMax?: number;
}) {
  const max = kind === "invite" ? (noteMax ?? 300) : 2000;
  const preview = fillTemplate(value, { firstName: previewName, company: previewCompany }).slice(0, max);
  const chunks = preview.split(/(https?:\/\/[^\s]+)/g);

  return (
    <div className="preview">
      <p className="kicker">Preview for {previewName}</p>
      <p className="review-body">
        {chunks.map((chunk, index) =>
          /^https?:\/\//.test(chunk) ? (
            <a key={index} href={chunk} target="_blank" rel="noreferrer">
              {chunk}
            </a>
          ) : (
            <span key={index}>{chunk}</span>
          ),
        )}
      </p>
    </div>
  );
}
