export function StatusBadge({ loading, isStale }) {
  const { color, label } = loading
    ? { color: "bg-amber-400", label: "Acquiring signal…" }
    : isStale
    ? { color: "bg-red-400", label: "Offline — last known" }
    : { color: "bg-instrument", label: "Live" };
  return (
    <div className="flex items-center gap-2 text-xs text-gray-300">
      <span className={`h-2 w-2 animate-pulse rounded-full ${color}`} />
      {label}
    </div>
  );
}
