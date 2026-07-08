export const KIE_BASE = "https://api.kie.ai/api/v1";

export function userKey(request: Request): string | null {
  return request.headers.get("X-KIE-Key");
}

export function kieHeaders(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export const noKey = () =>
  new Response(JSON.stringify({ error: "Missing kie.ai API key. Add it in Settings." }), {
    status: 401, headers: { "Content-Type": "application/json" },
  });
