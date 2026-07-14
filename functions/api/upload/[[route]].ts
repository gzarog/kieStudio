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

    // The File Upload API returns the hosted URL under `downloadUrl` (older/other
    // variants used `fileUrl`) — accept either so a contract tweak can't break us.
    const data = await res.json<{
      data?: {
        downloadUrl?: string;
        fileUrl?: string;
        fileName?: string;
        uploadedAt?: string;
        expiresAt?: string;
      };
    }>();
    const fileUrl = data.data?.downloadUrl ?? data.data?.fileUrl;
    if (!fileUrl) return json({ error: "Upload failed: no download URL returned." }, 502);

    return json({
      fileUrl,
      fileName: data.data?.fileName,
      expiresAt: data.data?.expiresAt ?? data.data?.uploadedAt,
    });
  });
