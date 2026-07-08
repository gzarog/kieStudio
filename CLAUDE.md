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
https://api.kie.ai/api/v1
```

## Features
- 💬 Chat — streaming LLM (Claude / GPT / Gemini)
- 🖼️ Image — GPT Image 2 / Nano Banana (async poll)
- 🎵 Music — Suno V4.5/V5.5 (async poll, audio player + cover)
- 🎬 Video — Veo 3.1 / Kling 3.0 / Seedance (async poll)
- 🔑 Key modal — validates + persists user key locally

## Deploy
```bash
npm install
npm run build
wrangler pages deploy dist --project-name kie-studio
```
No secrets needed. Done — it's live globally.

## Gotchas
- kie.ai media URLs expire after 14 days — tell users to download
- Rate limit 20 req/10s per key — submit buttons are debounced
- Workers: fetch/Request/Response only, no Node APIs
