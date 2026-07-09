import { daysLeft, expiryLabel } from "../../lib/history";

/** "expires in N days" chip next to each download link — kie.ai retains media 14 days. */
export function ExpiryBadge({ createdAt }: { createdAt?: number }) {
  if (!createdAt) return null;
  const d = daysLeft(createdAt);
  const tone =
    d <= 0
      ? "text-red-400 bg-red-500/10"
      : d <= 3
        ? "text-amber-400 bg-amber-500/10"
        : "text-gray-400 bg-white/5";
  return (
    <span
      data-testid="expiry-badge"
      className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tone}`}
    >
      ⏳ {expiryLabel(createdAt)}
    </span>
  );
}
