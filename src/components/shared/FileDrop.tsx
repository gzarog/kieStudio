import { useRef, useState } from "react";
import type { DragEvent, ChangeEvent } from "react";

interface FileDropProps {
  /** Called with the picked/dropped file. */
  onFile: (file: File) => void;
  /** Hosted preview URL once the upload finished (shows a thumbnail). */
  previewUrl?: string;
  /** Show an in-flight state while the upload runs. */
  uploading?: boolean;
  accept?: string;
  label?: string;
  /** How to render the hosted preview — an image thumbnail (default) or a video. */
  previewKind?: "image" | "video";
}

/** Drag-and-drop zone (with click-to-browse fallback) for i2i / i2v / v2v source uploads. */
export function FileDrop({
  onFile,
  previewUrl,
  uploading = false,
  accept = "image/*",
  label = "Drop an image here, or click to browse",
  previewKind = "image",
}: FileDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFile(file);
    e.target.value = ""; // allow re-picking the same file
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      data-testid="file-drop"
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`w-full rounded-xl border-2 border-dashed p-4 text-center cursor-pointer transition-colors
        ${dragging ? "border-sky-500 bg-sky-500/10" : "border-edge bg-surface"}`}
    >
      <input ref={inputRef} type="file" accept={accept} onChange={handleChange}
        className="hidden" data-testid="file-input" />
      {uploading ? (
        <p className="text-gray-300 text-sm">Uploading…</p>
      ) : previewUrl ? (
        <div className="space-y-2">
          {previewKind === "video" ? (
            <video src={previewUrl} controls className="max-h-40 mx-auto rounded-lg" data-testid="file-preview-video" />
          ) : (
            <img src={previewUrl} alt="Uploaded source" className="max-h-40 mx-auto rounded-lg" />
          )}
          <p className="text-gray-400 text-xs">Click to replace</p>
        </div>
      ) : (
        <p className="text-gray-400 text-sm">{label}</p>
      )}
    </div>
  );
}
