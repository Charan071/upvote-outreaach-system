import Link from "next/link";
import { Icon } from "@/components/icons";
import { LocalHourRange, LocalTime } from "@/components/LocalTime";
import { formatJitterPhrase } from "@/lib/time";

export function NextStep({
  pendingCount,
  readyCount,
  queuedCount,
  workStartHour,
  workEndHour,
  timeZone,
  minJitterSec,
  maxJitterSec,
  nextSendAt,
  nextSendName,
}: {
  pendingCount: number;
  readyCount: number;
  queuedCount: number;
  workStartHour: number;
  workEndHour: number;
  timeZone?: string;
  minJitterSec: number;
  maxJitterSec: number;
  nextSendAt?: Date | string | null;
  nextSendName?: string | null;
}) {
  const step = pendingCount > 0 ? 2 : queuedCount > 0 || readyCount > 0 ? 3 : 1;
  const hours = <LocalHourRange startHour={workStartHour} endHour={workEndHour} timeZone={timeZone} />;
  const gap = formatJitterPhrase(minJitterSec, maxJitterSec);

  return (
    <section className="next-step">
      <ol className="flow-steps">
        <li className={step >= 1 ? "on" : ""}>
          <span>1</span> Add people
        </li>
        <li className={step >= 2 ? "on" : ""}>
          <span>2</span> Look up names
        </li>
        <li className={step >= 3 ? "on" : ""}>
          <span>3</span> Send invites
        </li>
      </ol>
      {pendingCount > 0 ? (
        <div className="next-step-body">
          <div>
            <p className="kicker">Next</p>
            <h2>Looking up {pendingCount} name{pendingCount === 1 ? "" : "s"}</h2>
            <p className="muted">
              The worker visits one LinkedIn profile at a time, with {gap}. Invites wait until {hours}.
            </p>
          </div>
        </div>
      ) : queuedCount > 0 ? (
        <div className="next-step-body">
          <div>
            <p className="kicker">Next</p>
            <h2>Sending {queuedCount} invite{queuedCount === 1 ? "" : "s"}</h2>
            <p className="muted">
              {nextSendAt ? (
                <>
                  Next send <LocalTime at={nextSendAt} />
                  {nextSendName ? ` · ${nextSendName}` : ""}. The rest follow one at a time during {hours}, with {gap}.
                </>
              ) : (
                <>
                  The worker sends one connection request at a time during {hours}, with {gap} so they are not sent in
                  a burst.
                </>
              )}
            </p>
          </div>
          <Link className="btn secondary" href="/campaigns">
            <Icon name="campaign" size={16} /> View campaigns
          </Link>
        </div>
      ) : readyCount > 0 ? (
        <div className="next-step-body">
          <div>
            <p className="kicker">Next</p>
            <h2>Write the invite</h2>
            <p className="muted">
              {readyCount} contact{readyCount === 1 ? " is" : "s are"} ready. Write one note; the worker queues and
              sends it one person at a time.
            </p>
          </div>
          <Link className="btn" href="/campaigns/new">
            <Icon name="send" size={16} /> Write invite
          </Link>
        </div>
      ) : (
        <div className="next-step-body">
          <div>
            <p className="kicker">Next</p>
            <h2>Add LinkedIn URLs</h2>
            <p className="muted">Collect today’s Product Hunt makers, or paste profile links below.</p>
          </div>
        </div>
      )}
    </section>
  );
}
