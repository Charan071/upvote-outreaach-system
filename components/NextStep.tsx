import Link from "next/link";
import { QueueTickButton } from "@/components/QueueTickButton";
import { Icon } from "@/components/icons";

export function NextStep({
  pendingCount,
  readyCount,
}: {
  pendingCount: number;
  readyCount: number;
}) {
  const step = pendingCount > 0 ? 2 : readyCount > 0 ? 3 : 1;

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
            <h2>Look up {pendingCount} name{pendingCount === 1 ? "" : "s"}</h2>
            <p className="muted">
              LinkedIn allows about 100 profile visits a day. Each visit is spaced out. Invites wait until
              9:00–18:00; name lookups can run now.
            </p>
          </div>
          <QueueTickButton label="Look up next profile" icon="sync" primary />
        </div>
      ) : readyCount > 0 ? (
        <div className="next-step-body">
          <div>
            <p className="kicker">Next</p>
            <h2>Write the invite and send</h2>
            <p className="muted">
              {readyCount} contact{readyCount === 1 ? " is" : "s are"} ready. You’ll write the note, then send
              connection requests one at a time.
            </p>
          </div>
          <Link className="btn" href="/campaigns/new">
            <Icon name="send" size={16} /> Write invite and send
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
