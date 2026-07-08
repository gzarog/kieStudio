import { getApiKey } from "./apiKey";

const headers = () => ({
  "Content-Type": "application/json",
  "X-KIE-Key": getApiKey(),
});

export async function postToWorker<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.text()) || `Error ${res.status}`);
  return res.json();
}

export async function getFromWorker<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export function streamChat(model: string, messages: { role: string; content: string }[]) {
  return fetch("/api/chat/stream", { method: "POST", headers: headers(), body: JSON.stringify({ model, messages }) });
}
