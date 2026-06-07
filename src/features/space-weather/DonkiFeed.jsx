const CHIP = {
  FLR: "bg-amber-500/20 text-amber-300",
  CME: "bg-fuchsia-500/20 text-fuchsia-300",
  GST: "bg-red-500/20 text-red-300",
  IPS: "bg-sky-500/20 text-sky-300",
  RBE: "bg-violet-500/20 text-violet-300",
};

function timeLabel(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16).replace("T", " ") + "Z";
}

export function DonkiFeed({ events }) {
  const list = (events ?? []).slice(0, 6);
  return (
    <div className="rounded-xl bg-space-1 p-4 ring-1 ring-white/5">
      <div className="text-xs uppercase tracking-widest text-gray-400">
        Recent Events
      </div>
      {list.length === 0 ? (
        <div className="mt-3 font-mono text-sm text-gray-500">
          No recent space-weather events
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {list.map((e) => (
            <li key={e.id} className="flex gap-3 text-sm">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-mono ${CHIP[e.type] ?? "bg-white/10 text-gray-300"}`}>
                {e.type}
              </span>
              <a
                href={e.url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-instrument"
              >
                {e.summary || e.type}
                <span className="ml-2 text-xs text-gray-500">{timeLabel(e.issueTime)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
