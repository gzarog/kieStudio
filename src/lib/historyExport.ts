// Bulk download and history export/import for all pages.

import { loadHistory, saveHistory } from "./history";
import { toast } from "./ui";

export function downloadUrl(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function downloadAll(urls: string[], prefix: string) {
  let count = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const blob = await res.blob();
      const ext = blob.type.includes("video") ? "mp4"
        : blob.type.includes("audio") ? "mp3"
        : blob.type.includes("png") ? "png" : "jpg";
      const objectUrl = URL.createObjectURL(blob);
      downloadUrl(objectUrl, `${prefix}-${++count}.${ext}`);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch {
      continue;
    }
  }
  toast(`Downloaded ${count} of ${urls.length} files`, count > 0 ? "success" : "error");
}

export function exportHistory(page: string) {
  const data = loadHistory(page);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  downloadUrl(objectUrl, `kie-${page}-history.json`);
  setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
  toast(`Exported ${data.length} entries`, "success");
}

export function importHistory(page: string, file: File, onDone: () => void) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if (!Array.isArray(data)) throw new Error("Invalid format");
      const existing = loadHistory(page);
      const merged = [...data, ...existing];
      saveHistory(page, merged);
      toast(`Imported ${data.length} entries`, "success");
      onDone();
    } catch {
      toast("Invalid history file", "error");
    }
  };
  reader.readAsText(file);
}
