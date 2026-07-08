# KIE Studio

Global AI studio — chat, image, music, video — powered by kie.ai, deployed on Cloudflare Pages.
**BYOK**: users bring their own kie.ai API key (stored in their browser only).

- 💬 **Chat** — streaming LLM responses (Claude / GPT / Gemini), with stop, copy, and a
  conversation that survives a refresh.
- 🖼️ **Image** — GPT Image 2 / Nano Banana, with a per-session history of results.
- 🎵 **Music** — Suno V4.5 / V5.5, audio player + cover art.
- 🎬 **Video** — Veo 3.1 / Kling 3.0 / Seedance.

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

## Local dev
```bash
npx wrangler pages dev dist   # terminal 1 (workers on :8788)
npm run dev                   # terminal 2 (vite on :5173, proxies /api)
```
