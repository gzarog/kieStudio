# KIE Studio

Global AI studio — chat, image, music, video, speech — powered by kie.ai, deployed on
Cloudflare Pages. **BYOK**: users bring their own kie.ai API key (stored in their browser only).

- 💬 **Chat** — streaming LLM responses (Claude / GPT / Gemini), with stop, copy, and a
  conversation that survives a refresh.
- 🖼️ **Image** — Create (GPT Image 2, Nano Banana Pro, Grok Imagine, Ideogram V3, Qwen2, …)
  and **Edit / Remix** (Nano Banana Edit, Seedream 4.5 Edit, Flux-2 i2i, Qwen2 Edit,
  Recraft background removal) with drag-and-drop image upload.
- 🎵 **Music** — Suno V4.5 / V5.5 with per-track **studio actions**: Extend, vocal/stem
  separation, WAV master conversion, timestamped lyrics (the Suno → stems → DAW →
  distribution workflow).
- 🎬 **Video** — Text-to-Video (Veo 3.1, Kling 3.0, Seedance 2.0, Hailuo, Wan, …) and
  **Image-to-Video** (Veo 3.1, Kling 2.6, ByteDance, Hailuo 2.3, Wan 2.5) from an uploaded frame.
- 🗣️ **Speech** — ElevenLabs TTS (Turbo 2.5, Multilingual V2) with voice + speed controls.

Model pickers are driven by a **verified model catalog** (`src/lib/types.ts`): every
identifier is copied verbatim from its docs.kie.ai page — including each model's exact
image-input field name, which is *not* uniform across providers.

### How generation works (async polling)

Most models ride kie.ai's **Unified Jobs API**: submit `POST /api/v1/jobs/createTask`,
then poll `GET /api/v1/jobs/recordInfo` until `state` reaches `success`/`fail` (the worker
normalizes everything to `pending | success | failed`). Chat, Suno, and Veo keep dedicated
routers. There are **no webhook callbacks** — BYOK has no server state to receive them.

Uploads for image-to-image / image-to-video go through the **File Upload API**
(`/api/upload` → `kieai.redpandaai.co`), which returns a hosted URL passed in the model's
`input`. Uploaded files expire after ~3 days; generated media after **14 days** — every
result card shows an "expires in N days" badge and a Download link. Download promptly.

Your remaining credits show in the header after key validation and refresh after each
completed task. Hitting the rate limit (20 requests / 10s, HTTP 429 = rejected) toasts a
notice and the poller backs off exponentially. Result history is persisted per page in
`localStorage` (latest 50 entries).

## Get your key

Every request uses **your own** kie.ai key — nothing is stored on the server.

1. Sign up at **[kie.ai/api-key](https://kie.ai/api-key)** (80 free trial credits).
2. Copy the key and paste it into the 🔑 **API Key** modal on first visit.
3. The app validates it against kie.ai and shows your remaining credits. The key lives only
   in your browser's `localStorage` and travels as an `X-KIE-Key` header, which the edge
   function forwards to kie.ai as `Authorization: Bearer`.

> Media URLs from kie.ai **expire after 14 days** — download anything you want to keep.
> Failed generations are **not charged**.

## Deploy

### Automated (GitHub Actions)

Every push to `main` builds and deploys to Cloudflare Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml); every PR runs typecheck +
build + a bundle-size gate via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

One-time setup — add two **repository secrets** (Settings → Secrets and variables → Actions):

| Secret | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → create a token with **Cloudflare Pages: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → account ID in the right sidebar |

Until both secrets are set, the deploy step is skipped (with a warning) so `main` stays green.
The pipeline injects **no** kie.ai key — the app is BYOK, so there are no app secrets.

First time only, create the Pages project (once, locally):
```bash
npx wrangler pages project create kie-studio
```

### Manual (2 commands)
```bash
npm install && npm run build
npx wrangler pages deploy dist --project-name kie-studio
```
No app secrets required. Live globally on Cloudflare edge instantly.

## Custom domain

After the first deploy, attach a domain in the Cloudflare dashboard:

1. **Cloudflare dashboard → Pages → `kie-studio` → Custom domains → Set up a domain**.
2. Enter your domain or subdomain (e.g. `studio.example.com`).
3. If the domain is already on Cloudflare, the CNAME is added automatically; otherwise add
   the shown CNAME record at your DNS provider. TLS is provisioned for you.

No environment variables or secrets are needed on the custom domain — it stays fully BYOK.

## Run locally with Docker

One command builds the SPA and serves it together with the Pages Functions on the same
`workerd` edge runtime used in production:

```bash
docker compose up --build
```

Open **http://localhost:8788** and paste your kie.ai key into the 🔑 modal. No secrets to
configure — it's BYOK, so nothing is stored server-side. Stop with `Ctrl-C` (or
`docker compose down`).

## Local dev (hot reload)
```bash
npx wrangler pages dev dist   # terminal 1 (workers on :8788)
npm run dev                   # terminal 2 (vite on :5173, proxies /api)
```

## Tests

Unit and integration tests run on [Vitest](https://vitest.dev) with jsdom + React
Testing Library. They cover every feature end-to-end with `fetch` stubbed — no kie.ai
key or network is needed.

```bash
npm test              # run once (also runs in CI)
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

What's covered:

- **Edge functions** (`functions/api/*`) — chat streaming pass-through, the generic Jobs
  proxy, image/music/video submit + poll routing, the file-upload proxy, the Suno studio
  actions (extend / stems / WAV / lyrics), key validation (incl. numeric credits), and the
  shared `_lib` helpers (CORS, status normalization across all documented vocabularies,
  error `guard`).
- **Client lib** — the BYOK key store, `kieClient` request/error handling (incl. the typed
  429 `RateLimitError`), the upload helper, per-page history persistence + expiry math,
  the credits bus, the toast & key-modal buses, and the `useTaskPoller` hook (incl.
  exponential backoff on rate limits).
- **UI** — `KeyModal`, `Toaster`, `TaskStatusBadge`, `FileDrop`, `ExpiryBadge`,
  `TrackActions`, and each page (Chat, Image, Music, Video, Speech) driven from prompt to
  rendered result.
