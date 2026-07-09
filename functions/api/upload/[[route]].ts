// File Upload API proxy (docs.kie.ai/file-upload-api). The frontend reads the
// file locally, sends it here as a base64 data-URL, and gets back a hosted URL
// to pass in i2i/i2v `input` fields. BYOK as everywhere: key via X-KIE-Key.
//
//   POST /api/upload { base64Data, fileName?, uploadPath? } → { fileUrl, fileName, expiresAt }
import { userKey, noKey, badRequest, json, guard, uploadBase64 } from "../_lib";

export { onRequestOptions } from "../_lib";

export const onRequestPost: PagesFunction = (ctx) =>
  guard(async () => {
    const key = userKey(ctx.request);
    if (!key) return noKey();

    const b = await ctx.request.json<{
      base64Data?: string;
      fileName?: string;
      uploadPath?: string;
    }>();
    if (!b.base64Data?.startsWith("data:"))
      return badRequest("base64Data must be a data: URL (e.g. data:image/png;base64,…).");

    const res = await uploadBase64(key, b.base64Data, b.fileName, b.uploadPath ?? "images");
    if (!res.ok) return json({ error: await res.text() }, res.status);

    const data = await res.json<{
      data?: { fileUrl?: string; fileName?: string; expiresAt?: string };
    }>();
    if (!data.data?.fileUrl) return json({ error: "Upload failed: no fileUrl returned." }, 502);

    return json({
      fileUrl: data.data.fileUrl,
      fileName: data.data.fileName,
      expiresAt: data.data.expiresAt,
    });
  });
