import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/components/icons";
import { statusLabel } from "@/lib/status";

export function PageHeader({
  kicker,
  title,
  actions,
}: {
  kicker?: string;
  title: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        {kicker ? <p className="kicker">{kicker}</p> : null}
        <h1>{title}</h1>
      </div>
      {actions ? <div className="actions">{actions}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
}) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Empty({
  title,
  body,
  action,
  icon = "empty",
}: {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: IconName;
}) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <h2>{title}</h2>
      <p>{body}</p>
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ready" ||
    status === "sent" ||
    status === "positive" ||
    status === "running" ||
    status === "completed"
      ? "good"
      : status === "failed" ||
          status === "enrich_failed" ||
          status === "excluded" ||
          status === "stop" ||
          status === "decline"
        ? "bad"
        : status === "pending" || status === "pending_review" || status === "queued" || status === "paused" || status === "draft"
          ? "warn"
          : status === "invited" || status === "connected" || status === "messaged" || status === "skipped"
            ? "accent"
            : "neutral";
  return <Badge tone={tone}>{statusLabel(status)}</Badge>;
}

export function Stat({
  value,
  label,
  icon,
  style,
}: {
  value: ReactNode;
  label: string;
  icon?: IconName;
  style?: CSSProperties;
}) {
  return (
    <div className="stat" style={style}>
      <div className="stat-label">
        {icon ? <Icon name={icon} size={16} /> : null}
        <span>{label}</span>
      </div>
      <strong>{value}</strong>
    </div>
  );
}
