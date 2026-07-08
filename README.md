# KIE Studio

Global AI studio — chat, image, music, video — powered by kie.ai, deployed on Cloudflare Pages.
**BYOK**: users bring their own kie.ai API key (stored in their browser only).

## Deploy (2 commands)
```bash
npm install && npm run build
npx wrangler pages deploy dist --project-name kie-studio
```
No secrets required. Live globally on Cloudflare edge instantly.

## Local dev
```bash
npx wrangler pages dev dist   # terminal 1 (workers on :8788)
npm run dev                   # terminal 2 (vite on :5173, proxies /api)
```
