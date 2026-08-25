"use client";

import { useEffect, useState } from "react";
import { formatLocalClock, formatLocalDateTime, formatLocalHourRange, formatLocalSchedule } from "@/lib/time";

function isoOf(at: string | Date) {
  return typeof at === "string" ? at : at.toISOString();
}

export function LocalTime({
  at,
  mode = "schedule",
}: {
  at: string | Date;
  mode?: "schedule" | "datetime" | "clock";
}) {
  const iso = isoOf(at);
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return;
    const now = new Date();
    setLabel(
      mode === "clock"
        ? formatLocalClock(date)
        : mode === "datetime"
          ? formatLocalDateTime(date)
          : formatLocalSchedule(date, now),
    );
  }, [iso, mode]);

  return (
    <time dateTime={iso} title={iso}>
      {label ?? "…"}
    </time>
  );
}

export function LocalHourRange({
  startHour,
  endHour,
  timeZone,
}: {
  startHour: number;
  endHour: number;
  timeZone?: string;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(formatLocalHourRange(startHour, endHour, timeZone));
  }, [startHour, endHour, timeZone]);

  return <span>{label ?? `${startHour}:00–${endHour}:00`}</span>;
}
