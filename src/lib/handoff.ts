// Cross-feature chaining: pass a media URL from one page to another.
// E.g. "Use in Video" on an image result navigates to /video with the URL pre-filled.

export interface Handoff {
  mediaUrl: string;
  kind: "image" | "video";
}

let pending: Handoff | null = null;

export function setHandoff(h: Handoff) { pending = h; }

export function consumeHandoff(): Handoff | null {
  const h = pending;
  pending = null;
  return h;
}
