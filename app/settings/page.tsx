import { getSettings } from "@/lib/queue";
import { getAccountSnapshot, healthLabel, healthTone, syncUnipileStatus } from "@/lib/health";
import { SettingsForm } from "@/components/SettingsForm";
import { Badge, PageHeader, Stat } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await syncUnipileStatus();
  const settings = await getSettings();
  const snapshot = await getAccountSnapshot(settings);

  return (
    <>
      <PageHeader kicker="Controls" title="Settings" />
      <div className="stats">
        <Stat
          value={<Badge tone={healthTone(snapshot.health)}>{healthLabel(snapshot.health)}</Badge>}
          label="Account health"
          icon="settings"
        />
        <Stat value={`${snapshot.remaining.invites}/${snapshot.dailyCap}`} label="Invites left today" icon="send" />
        <Stat value={snapshot.queued} label="Queued on running campaigns" icon="campaign" />
        <Stat
          value={settings.nextAllowedAt ? settings.nextAllowedAt.toLocaleTimeString() : "now"}
          label="Next LinkedIn action"
          icon="clock"
        />
      </div>
      <section className="panel stack" style={{ marginBottom: 18 }}>
        <p className="kicker">Live account</p>
        {snapshot.warning ? <p className="warn-text">{snapshot.warning}</p> : null}
        <p className="muted">
          Connection {settings.unipileStatus || "unknown"} · last sync{" "}
          {settings.lastSyncAt ? settings.lastSyncAt.toLocaleString() : "never"} · weekly invites{" "}
          {snapshot.remaining.weeklyInvites} left · messages {snapshot.remaining.messages} left · profile
          visits {snapshot.remaining.profiles} left.
        </p>
        {settings.lastError ? <p className="muted">Last failure: {settings.lastError}</p> : null}
        <p className="muted">
          LinkedIn runs through Unipile as a hosted session. This app does not store LinkedIn passwords or
          cookies, and does not use Composio or unofficial browser/proxy workarounds. Connecting extra
          LinkedIn accounts is parked; use <code>UNIPILE_ACCOUNT_ID</code>.
        </p>
      </section>
      <p className="muted" style={{ marginBottom: 18 }}>
        Point Unipile’s Users webhook (events <code>new_relation</code> and Account Status) at{" "}
        <code>/api/webhooks/unipile</code>. Inbox chats are synced by Unipile; use Review → Sync inbox only
        on demand.
      </p>
      <SettingsForm
        paused={settings.paused}
        pausedReason={settings.pausedReason}
        accountTier={settings.accountTier}
        timezone={settings.timezone}
        workStartHour={settings.workStartHour}
        workEndHour={settings.workEndHour}
        dailyCap={snapshot.dailyCap}
        messageDailyCap={snapshot.messageDailyCap}
        profileDailyCap={snapshot.profileDailyCap}
        weeklyInviteCap={snapshot.weeklyInviteCap}
        minJitterSec={settings.minJitterSec}
        maxJitterSec={settings.maxJitterSec}
        defaultTemplate={settings.defaultTemplate}
        invitesToday={settings.invitesToday}
        invitesThisWeek={settings.invitesThisWeek}
        messagesToday={settings.messagesToday}
        profilesToday={settings.profilesToday}
      />
    </>
  );
}
