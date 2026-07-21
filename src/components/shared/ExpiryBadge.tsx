import { useState, useEffect } from "react";
import { daysLeft, expiryLabel } from "../../lib/history";
import { vaultHas, vaultSave, vaultDelete } from "../../lib/vault";
import { toast } from "../../lib/ui";

interface Props {
  createdAt?: number;
  mediaUrl?: string;
}

export function ExpiryBadge({ createdAt, mediaUrl }: Props) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mediaUrl) { vaultHas(mediaUrl).then(setSaved).catch(() => {}); }
  }, [mediaUrl]);

  async function toggleSave() {
    if (!mediaUrl) return;
    setSaving(true);
    try {
      if (saved) {
        await vaultDelete(mediaUrl);
        setSaved(false);
        toast("Removed from vault", "info", 2000);
      } else {
        const ok = await vaultSave(mediaUrl);
        setSaved(ok);
        toast(ok ? "Saved to vault" : "Couldn't save — URL may have expired", ok ? "success" : "error");
      }
    } finally { setSaving(false); }
  }

  if (saved) {
    return (
      <button onClick={toggleSave} disabled={saving}
        data-testid="expiry-badge"
        className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium text-emerald-400 bg-emerald-500/10 disabled:opacity-50">
        💾 saved locally
      </button>
    );
  }

  if (!createdAt) {
    return mediaUrl ? (
      <button onClick={toggleSave} disabled={saving}
        data-testid="expiry-badge"
        className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium text-gray-400 bg-white/5 disabled:opacity-50">
        {saving ? "Saving…" : "💾 Save"}
      </button>
    ) : null;
  }

  const d = daysLeft(createdAt);
  const tone =
    d <= 0
      ? "text-red-400 bg-red-500/10"
      : d <= 3
        ? "text-amber-400 bg-amber-500/10"
        : "text-gray-400 bg-white/5";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        data-testid="expiry-badge"
        className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium ${tone}`}
      >
        ⏳ {expiryLabel(createdAt)}
      </span>
      {mediaUrl && (
        <button onClick={toggleSave} disabled={saving}
          className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-medium text-sky-400 bg-sky-500/10 disabled:opacity-50">
          {saving ? "…" : "💾 Save"}
        </button>
      )}
    </span>
  );
}
