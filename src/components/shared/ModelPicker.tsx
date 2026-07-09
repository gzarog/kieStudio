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
  music: "Music",
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
  className?: string;
}

/** Catalog-driven model select: options grouped by provider, capability badges below. */
export function ModelPicker({ category, value, onChange, className }: ModelPickerProps) {
  const models = catalogByCategory(category);
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
      {selected && <CapabilityBadges capabilities={selected.capabilities} />}
    </div>
  );
}
