# KIE Studio — Global BYOK Edition

Full-stack AI studio on **Cloudflare Pages + Workers** (global edge network).
**BYOK model**: every user brings their own kie.ai API key — stored only in their browser (localStorage), sent per-request via `X-KIE-Key` header, forwarded by Workers to kie.ai. **Zero secrets on the server, zero cost risk to the operator.**

## Architecture
```
Browser (React+Vite, key in localStorage)
   │  fetch /api/* with X-KIE-Key header
   ▼
Cloudflare Pages Functions (edge, 300+ cities)
   │  Authorization: Bearer <user key>
   ▼
https://api.kie.ai/api/v1          (Jobs API + dedicated routers)
https://kieai.redpandaai.co        (File Upload API — separate host)
```

## Endpoint layer (verified against docs.kie.ai)
- **Unified Jobs API** (most Market models — image, video, TTS):
  `POST /jobs/createTask { model, input }` → poll `GET /jobs/recordInfo?taskId=`.
  `data.state` is lowercase (`waiting|queuing|generating|success|fail`);
  `data.resultJson` is a **stringified** JSON → parse, read `resultUrls[]`.
  Generic proxy: `POST /api/jobs/submit` + `GET /api/jobs/status` — adding a new
  Market model is a frontend-only catalog row.
- **Dedicated routers**: Chat (`/chat/completions`, SSE), Suno (`/generate` + extras:
  `/generate/extend`, `/vocal-removal/*`, `/wav/*`, `/lyrics/*`,
  `/generate/get-timestamped-lyrics`), Veo 3.1 (`/veo/*`).
- **Common API**: `GET /chat/credit` → `{ code, msg, data: <number> }` (credits display).
- **File Upload**: `POST /api/upload` proxies the base64 variant; returns a hosted URL
  used as the model's image input. The image field name varies per model (`image_urls` /
  `image_url` / `image_input` / `input_urls` / `image` / Veo's `imageUrls`) — see
  `imageField` in the catalog (`src/lib/types.ts`). Never infer identifiers or fields:
  copy them from each model's doc page.
- **No webhooks** — BYOK has no server state; everything polls (status normalized to
  `pending | success | failed` in `functions/api/_lib.ts`).

## Features
- 💬 Chat — streaming LLM (Claude / GPT / Gemini)
- 🖼️ Image — Create + Edit/Remix modes (GPT Image 2, Nano Banana Pro/Edit, Seedream 4.5
  Edit, Flux-2, Grok Imagine, Ideogram V3, Qwen2, Recraft remove-bg) with drag-and-drop upload
- 🎵 Music — Suno V4.5/V5.5 + per-track studio actions: Extend, stem separation
  (`separate_vocal`/`split_stem`), convert-to-WAV, timestamped lyrics
- 🎬 Video — T2V (Veo 3.1 / Kling 3.0 / Seedance 2.0 / Hailuo / Wan / …) + I2V from an
  uploaded frame (Veo, Kling 2.6, ByteDance, Hailuo 2.3, Wan 2.5)
- 🗣️ Speech — ElevenLabs TTS (Turbo 2.5, Multilingual V2) via the generic Jobs proxy
- 🔑 Key modal — validates + persists user key locally; remaining credits show in the
  header and refresh after each completed task

## Deploy
```bash
npm install
npm run build
wrangler pages deploy dist --project-name kie-studio
```
No secrets needed. Done — it's live globally.

## Gotchas
- kie.ai media URLs expire: account retention is **14 days**, and Jobs `recordInfo` URLs
  may lapse even sooner — every result card carries an "expires in N days" badge and a
  Download link; download promptly. Uploaded source files expire in ~3 days.
- Rate limit **20 req/10s per key**; a 429 is **rejected, not queued** — submit buttons are
  debounced, `kieClient` throws a typed `RateLimitError`, and `useTaskPoller` backs off
  exponentially (toast shown once per task).
- Result history persists per page in `localStorage` (`kie.history.*`, latest 50 entries).
- Workers: fetch/Request/Response only, no Node APIs.
- Model naming is NOT uniform (e.g. `kling-3.0/video`, `bytedance/seedance-2`,
  `nano-banana-pro`, `gpt-image-2-text-to-image`) — verify each id on docs.kie.ai before
  adding it to the catalog; keep `verified: true` honest.
