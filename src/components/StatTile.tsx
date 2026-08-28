export default function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: "success" | "danger" | "warning" | "primary";
}) {
  return (
    <div className={`stat-tile ${accent ? `accent-${accent}` : ""}`}>
      <div className="value">{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
