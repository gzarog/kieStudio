import { KIE_BASE, userKey, kieHeaders, noKey } from "../_lib";

export const onRequestPost: PagesFunction = async (ctx) => {
  const key = userKey(ctx.request);
  if (!key) return noKey();

  const b = await ctx.request.json<{ prompt: string; model: string; size: string }>();
  const res = await fetch(`${KIE_BASE}/image/generate`, {
    method: "POST", headers: kieHeaders(key), body: JSON.stringify(b),
  });
  if (!res.ok) return new Response(await res.text(), { status: res.status });
  const data = await res.json<{ data: { taskId: string } }>();
  return Response.json({ taskId: data.data.taskId });
};

export const onRequestGet: PagesFunction = async (ctx) => {
  const key = userKey(ctx.request);
  if (!key) return noKey();

  const taskId = new URL(ctx.request.url).searchParams.get("taskId");
  if (!taskId) return Response.json({ error: "Missing taskId" }, { status: 400 });

  const res = await fetch(`${KIE_BASE}/image/record-info?taskId=${taskId}`, { headers: kieHeaders(key) });
  const data = await res.json<{ data: { status: string; errorMessage?: string; response?: { imageUrl?: string; resultUrls?: string[] } } }>();

  const s = data.data.status;
  if (s === "SUCCESS") {
    const url = data.data.response?.imageUrl ?? data.data.response?.resultUrls?.[0];
    return Response.json({ status: "success", result: { imageUrl: url } });
  }
  if (s === "FAILED" || s?.includes("ERROR")) return Response.json({ status: "failed", result: null, error: data.data.errorMessage });
  return Response.json({ status: "pending", result: null });
};
