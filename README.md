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

## Deploy (2 commands)
```bash
npm install && npm run build
npx wrangler pages deploy dist --project-name kie-studio
```
No secrets required. Live globally on Cloudflare edge instantly.

First time only:
```bash
npx wrangler pages project create kie-studio
```

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
