export function StatusBadge({ loading, isStale }) {
  const { color, label } = loading
    ? { color: "bg-amber-400", label: "Acquiring signal…" }
    : isStale
    ? { color: "bg-red-400", label: "Offline — last known" }
    : { color: "bg-instrument", label: "Live" };
  return (
    <div
      role="status"
      className="flex items-center gap-2 text-xs text-gray-300"
    >
      <span
        className={`h-2 w-2 rounded-full motion-safe:animate-pulse ${color}`}
      />
      {label}
    </div>
  );
}
