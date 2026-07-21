# KIE Studio — Enhancement Plan

A prioritized roadmap of suggested enhancements, grounded in the current codebase
(React 18 + Vite 5 SPA, Cloudflare Pages Functions proxy, BYOK via `X-KIE-Key`,
localStorage history, per-page task poller). Each item notes why it matters, what
it touches, and a rough size (S / M / L).

---

## Phase 1 — High-impact UX gaps (quick wins)

### 1.1 Markdown rendering in Chat (S)
Assistant replies render as plain `whitespace-pre-wrap` text (`ChatPage.tsx`),
so code blocks, lists, and tables from Claude/GPT/Gemini are unreadable.
- Add a lightweight markdown renderer (e.g. `react-markdown` + `rehype-highlight`,
  or a small hand-rolled subset to keep the bundle lean).
- Code blocks get a per-block Copy button (the existing `copy()` helper is reusable).
- Touches: `ChatPage.tsx` only.

### 1.2 Multiple chat conversations (M)
Chat keeps exactly one conversation in `sessionStorage` (`kie_chat_history`);
"New session" wipes it. Image/Video/Music already have per-page history via
`lib/history.ts` — Chat is the odd one out.
- Store named conversations in `localStorage` (`kie.history.chat`), reusing
  `loadHistory`/`saveHistory` and the existing `SessionSidebar` + `sessionBus`
  (which already emits new-session / delete-entry events).
- Auto-title from the first user message; switching conversations aborts any
  in-flight stream (the `AbortController` plumbing already exists).
- Touches: `ChatPage.tsx`, `SessionSidebar.tsx`, `sessionBus.ts`.

### 1.3 Send-to-… cross-feature chaining (M)
The catalog already distinguishes `t2i / i2i / i2v / v2v`, but results are dead
ends: an image result can't become a Video page I2V source or an Image Edit
source without manual download/re-upload.
- Add "Use in Video" / "Edit this image" / "Extend" actions on result cards that
  navigate with the media URL pre-filled (router state or a small handoff store,
  same pattern as `sessionBus`).
- Because kie.ai already hosts the result URL, no re-upload is needed — pass the
  URL straight into the model's `imageField` / `videoField`.
- Touches: result cards in `ImagePage` / `VideoPage`, a tiny `handoff.ts` lib.

### 1.4 Estimated cost per generation (S–M)
Credits show in the header, but users only learn a model's price after running it.
- Add an optional `credits?: number | string` hint per catalog row
  (`src/lib/types.ts`) shown in `ModelPicker` and next to the submit button
  ("~40 credits"). Values copied from docs.kie.ai pricing pages — same
  "verified, never inferred" rule as model ids.
- After task completion the header already refreshes credits; also show the
  delta as a toast ("−40 credits") by diffing in `lib/credits.ts`.

---

## Phase 2 — Protecting user output (the expiry problem)

### 2.1 Local media vault via IndexedDB (L)
The single biggest data-loss risk: kie.ai URLs expire in ≤14 days and history
only stores URLs. Expired history entries are dead links.
- On task success, fetch the result blob and store it in IndexedDB (opt-in
  toggle, with a storage-usage meter; `navigator.storage.estimate()`).
- Result cards prefer the vaulted blob (`URL.createObjectURL`) and fall back to
  the remote URL; the `ExpiryBadge` flips to "saved locally".
- Eviction: LRU beyond a size cap; explicit "Free space" per entry.
- Touches: new `lib/vault.ts`, result cards, `ExpiryBadge`.

### 2.2 Bulk download / export (S)
- "Download all" per page (sequential fetch → `a[download]`, or a zip via
  `fflate` if bundle size allows).
- Export/import history JSON so users can move browsers — today history is
  trapped in one browser profile, which is a sharp edge of the BYOK design.
- Touches: `lib/history.ts`, page headers.

---

## Phase 3 — Power-user generation features

### 3.1 Prompt library + prompt history (M)
- Save/star prompts per category (`kie.prompts.*` in localStorage), quick-insert
  from a dropdown; auto-record the last 20 submitted prompts per page.
- Touches: new shared `PromptBox` component used by Image/Video/Music/Speech.

### 3.2 Multi-model compare (M)
- Image page: select 2–4 models, submit the same prompt to each (staggered to
  respect the 20 req/10s limit), render results side-by-side.
- Reuses the generic Jobs proxy; needs `useTaskPoller` to support multiple
  concurrent tasks (see 3.3).

### 3.3 Concurrent task queue (M)
`useTaskPoller` tracks exactly one task; submitting again replaces the previous
poll. Users generating video (minutes-long) can't start a second job or leave
the page without losing tracking.
- Persist in-flight tasks (`taskId`, `statusPath`, params, page) to localStorage
  and resume polling on load; show a small global "jobs" indicator in the header.
- Refactor `useTaskPoller` into a `taskQueue` store + a hook view over it.
  Backoff/rate-limit logic carries over unchanged.

### 3.4 Advanced params per model (M, incremental)
The `options`/`fixedInput` catalog mechanism already supports enums; extend it
with free-form verified fields where docs allow (seed, negative prompt,
guidance) — each is one catalog row edit, keeping the "copy from docs, never
infer" rule.

---

## Phase 4 — Platform & code health

### 4.1 ESLint + Prettier + typecheck in CI (S)
`devDependencies` has no linter; CI runs build/tests only. Add
`eslint` (typescript-eslint, react-hooks) + `prettier`, wire into
`.github/workflows/ci.yml`. React-hooks lint would catch real bugs (e.g. stale
closure risks in the pages).

### 4.2 Dependency refresh (M)
Vite 5 → 7, Vitest 2 → 3/4, Tailwind 3 → 4, React 18 → 19, Wrangler 3 → 4.
All mechanical but each has migration notes; do behind the test suite
(which is healthy: ~30 test files covering libs, functions, pages).

### 4.3 PWA / installability (S)
Add a manifest + minimal service worker (offline shell only — API calls always
need network). Pairs well with the IndexedDB vault (2.1) for offline playback
of saved media.

### 4.4 Error & rate-limit UX polish (S)
- Surface kie.ai's error `msg` verbatim in failure cards (some pages show only
  a generic message).
- Global request throttle in `kieClient` (client-side token bucket at ~18/10s)
  so bursts from compare mode / bulk download don't trip the server 429 at all.

### 4.5 Accessibility & keyboard pass (S)
Focus rings, `aria-label`s on icon-only buttons (the ⚙️ Key button, copy
buttons), `prefers-reduced-motion` for the smooth scroll, Escape to close
`KeyModal`.

---

## Suggested sequencing

| Order | Items | Rationale |
|-------|-------|-----------|
| 1 | 1.1, 1.4, 4.1 | Small, immediately visible, no architecture changes |
| 2 | 1.2, 1.3 | Builds on existing sidebar/history/handoff patterns |
| 3 | 3.3 then 3.2 | Queue is a prerequisite for compare mode |
| 4 | 2.1, 2.2 | Solves the expiry data-loss problem properly |
| 5 | 3.1, 3.4, 4.3–4.5 | Steady polish |
| 6 | 4.2 | Isolated upgrade PRs, one major bump each |

## Non-goals (by design)
- **Webhooks / server-side state** — contradicts the BYOK zero-server-state model.
- **Server-stored keys or accounts** — the key never leaves the browser except
  per-request via `X-KIE-Key`.
- **Unverified model ids** — every catalog addition must be copied from
  docs.kie.ai (`verified: true` stays honest).
