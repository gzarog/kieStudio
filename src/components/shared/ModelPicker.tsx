import { catalogByCategory, catalogModel, groupByProvider } from "../../lib/types";
import type { Capability, ModelCategory } from "../../lib/types";

const CAP_LABEL: Record<Capability, string> = {
  chat: "Chat",
  t2i: "T2I",
  i2i: "I2I",
  edit: "Edit",
  upscale: "Upscale",
  t2v: "T2V",
  i2v: "I2V",
  v2v: "V2V",
  music: "Music",
  tts: "TTS",
};

/** Small capability chips shown beneath the picker for the selected model. */
export function CapabilityBadges({ capabilities }: { capabilities: Capability[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" data-testid="capability-badges">
      {capabilities.map((c) => (
        <span key={c}
          className="px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-[10px] font-medium uppercase tracking-wide">
          {CAP_LABEL[c]}
        </span>
      ))}
    </div>
  );
}

interface ModelPickerProps {
  category: ModelCategory;
  value: string;
  onChange: (id: string) => void;
  /** Restrict the options to models advertising this capability. */
  capability?: Capability;
  /** Restrict to models that accept an uploaded source image (i2i/i2v/edit). */
  requireImage?: boolean;
  /** Restrict to models that accept an uploaded source video (v2v/video edit/upscale). */
  requireVideo?: boolean;
  className?: string;
}

/** Catalog-driven model select: options grouped by provider, capability badges below. */
export function ModelPicker({ category, value, onChange, capability, requireImage, requireVideo, className }: ModelPickerProps) {
  let models = catalogByCategory(category, capability);
  if (requireImage) models = models.filter((m) => m.imageField);
  if (requireVideo) models = models.filter((m) => m.videoField);
  const selected = catalogModel(value);

  return (
    <div className="space-y-1.5">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Model"
        className={
          className ??
          "bg-surface border border-edge text-white text-sm rounded-lg px-3 py-2"
        }
      >
        {groupByProvider(models).map(([provider, ms]) => (
          <optgroup key={provider} label={provider}>
            {ms.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <div className="flex items-center gap-2">
        {selected && <CapabilityBadges capabilities={selected.capabilities} />}
        {selected?.costHint && (
          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 text-[10px] font-medium">
            {selected.costHint} credits
          </span>
        )}
      </div>
    </div>
  );
}
