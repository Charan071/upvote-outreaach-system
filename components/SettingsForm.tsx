"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconLabel } from "@/components/icons";
import {
  clampInviteDailyCap,
  clampJitter,
  clampMessageDailyCap,
  clampProfileDailyCap,
  clampWeeklyInviteCap,
  inviteDailyMax,
  inviteWeeklyMax,
  remaining,
  UNIPILE_LINKEDIN,
} from "@/lib/limits";

type FormState = {
  paused: boolean;
  accountTier: string;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  dailyCap: number;
  messageDailyCap: number;
  profileDailyCap: number;
  weeklyInviteCap: number;
  minJitterSec: number;
  maxJitterSec: number;
};

function clampForm(next: FormState): FormState {
  const jitter = clampJitter(next.minJitterSec || 120, next.maxJitterSec || 180);
  return {
    ...next,
    dailyCap: clampInviteDailyCap(next.accountTier, next.dailyCap || 1),
    weeklyInviteCap: clampWeeklyInviteCap(next.accountTier, next.weeklyInviteCap || 1),
    messageDailyCap: clampMessageDailyCap(next.messageDailyCap || 1),
    profileDailyCap: clampProfileDailyCap(next.profileDailyCap || 1),
    minJitterSec: jitter.minJitterSec,
    maxJitterSec: jitter.maxJitterSec,
  };
}

export function SettingsForm({
  paused,
  pausedReason,
  accountTier,
  timezone,
  workStartHour,
  workEndHour,
  dailyCap,
  messageDailyCap,
  profileDailyCap,
  weeklyInviteCap,
  minJitterSec,
  maxJitterSec,
  invitesToday,
  invitesThisWeek,
  messagesToday,
  profilesToday,
}: {
  paused: boolean;
  pausedReason: string | null;
  accountTier: string;
  timezone: string;
  workStartHour: number;
  workEndHour: number;
  dailyCap: number;
  messageDailyCap: number;
  profileDailyCap: number;
  weeklyInviteCap: number;
  minJitterSec: number;
  maxJitterSec: number;
  invitesToday: number;
  invitesThisWeek: number;
  messagesToday: number;
  profilesToday: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState(
    clampForm({
      paused,
      accountTier,
      timezone,
      workStartHour,
      workEndHour,
      dailyCap,
      messageDailyCap,
      profileDailyCap,
      weeklyInviteCap,
      minJitterSec,
      maxJitterSec,
    }),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function patch(partial: Partial<FormState>) {
    setForm((current) => clampForm({ ...current, ...partial }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    setMsg(data.error || "Saved");
    if (!data.error && data.settings) {
      setForm(
        clampForm({
          ...form,
          paused: data.settings.paused,
          accountTier: data.settings.accountTier,
          dailyCap: data.settings.dailyCap,
          weeklyInviteCap: data.settings.weeklyInviteCap,
          messageDailyCap: data.settings.messageDailyCap,
          profileDailyCap: data.settings.profileDailyCap,
          minJitterSec: data.settings.minJitterSec,
          maxJitterSec: data.settings.maxJitterSec,
        }),
      );
    }
    router.refresh();
  }

  return (
    <form onSubmit={save} className="panel stack">
      <label className="check">
        <input
          type="checkbox"
          checked={form.paused}
          onChange={(e) => patch({ paused: e.target.checked })}
        />
        Pause all LinkedIn actions
      </label>
      {pausedReason ? <p className="warn-text">{pausedReason}</p> : null}

      <label>
        LinkedIn account
        <select value={form.accountTier} onChange={(e) => patch({ accountTier: e.target.value })}>
          <option value="paid">Paid / Premium (notes up to 300 chars)</option>
          <option value="free">Free (notes up to 200 chars; ~5/month with a note)</option>
        </select>
      </label>

      <div className="row">
        <label>
          Invite cap / day
          <input
            type="number"
            min={1}
            max={inviteDailyMax(form.accountTier)}
            value={form.dailyCap}
            onChange={(e) => patch({ dailyCap: Number(e.target.value) })}
          />
          <span className="muted cap-remaining">
            {remaining(invitesToday, form.dailyCap)} remaining today (max {inviteDailyMax(form.accountTier)})
          </span>
        </label>
        <label>
          Invite cap / week
          <input
            type="number"
            min={1}
            max={inviteWeeklyMax(form.accountTier)}
            value={form.weeklyInviteCap}
            onChange={(e) => patch({ weeklyInviteCap: Number(e.target.value) })}
          />
          <span className="muted cap-remaining">
            {remaining(invitesThisWeek, form.weeklyInviteCap)} remaining this week (max{" "}
            {inviteWeeklyMax(form.accountTier)})
          </span>
        </label>
      </div>
      <div className="row">
        <label>
          Messages to connections / day
          <input
            type="number"
            min={1}
            max={UNIPILE_LINKEDIN.messageDailyMax}
            value={form.messageDailyCap}
            onChange={(e) => patch({ messageDailyCap: Number(e.target.value) })}
          />
          <span className="muted cap-remaining">
            {remaining(messagesToday, form.messageDailyCap)} remaining (max {UNIPILE_LINKEDIN.messageDailyMax})
          </span>
        </label>
        <label>
          Profile visits / day
          <input
            type="number"
            min={1}
            max={UNIPILE_LINKEDIN.profileVisitDailyMax}
            value={form.profileDailyCap}
            onChange={(e) => patch({ profileDailyCap: Number(e.target.value) })}
          />
          <span className="muted cap-remaining">
            {remaining(profilesToday, form.profileDailyCap)} remaining (max {UNIPILE_LINKEDIN.profileVisitDailyMax})
          </span>
        </label>
      </div>

      <label>
        Timezone
        <input value={form.timezone} onChange={(e) => patch({ timezone: e.target.value })} />
        <span className="muted cap-remaining">Working hours and invite spacing use this zone. Default is UTC.</span>
      </label>
      <div className="row">
        <label>
          Work start hour
          <input
            type="number"
            min={0}
            max={23}
            value={form.workStartHour}
            onChange={(e) => patch({ workStartHour: Number(e.target.value) })}
          />
        </label>
        <label>
          Work end hour
          <input
            type="number"
            min={1}
            max={24}
            value={form.workEndHour}
            onChange={(e) => patch({ workEndHour: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="row">
        <label>
          Min gap (seconds)
          <input
            type="number"
            min={120}
            max={7200}
            value={form.minJitterSec}
            onChange={(e) => patch({ minJitterSec: Number(e.target.value) })}
          />
        </label>
        <label>
          Max gap (seconds)
          <input
            type="number"
            min={180}
            max={10800}
            value={form.maxJitterSec}
            onChange={(e) => patch({ maxJitterSec: Number(e.target.value) })}
          />
        </label>
      </div>
      <p className="muted">
        The background worker spaces LinkedIn actions randomly during working hours. Defaults are 8–25 minutes
        between sends and profile lookups. Paid accounts cannot exceed 80 invites/day and 200/week.
      </p>
      <button className="btn" disabled={busy} type="submit">
        <IconLabel name="save">{busy ? "Saving…" : "Save"}</IconLabel>
      </button>
      {msg ? <p className="muted">{msg}</p> : null}
    </form>
  );
}
