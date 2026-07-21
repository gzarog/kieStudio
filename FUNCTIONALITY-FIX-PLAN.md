# Functionality Error Audit — Fix Plan

Audit date: 2026-07-21. Scope: every Worker route (`functions/api/**`), every frontend
lib (`src/lib/**`), hook, page, and component. Build (`tsc --noEmit`) and the full test
suite (321 tests / 30 files) pass — all findings below are logic-level errors that type
checks and the current tests don't catch. Suno Extend semantics and the Veo request
fields were re-verified against docs.kie.ai during this audit.

---

## P1 — Broken functionality (fix first)

### 1. Suno "Extend" silently ignores the user's prompt and continue-at point
**Files:** `src/components/music/TrackActions.tsx`, `functions/api/suno/[[route]].ts`

Verified against the Extend Music doc page: with `defaultParamFlag: false`, **only
`audioId` is read — `prompt`, `style`, `title`, and `continueAt` are all ignored** and
inherited from the source track. With `defaultParamFlag: true`, all four are *required*.

Today the UI requires an extension prompt, sends `continueAt` when filled in, and only
sets `defaultParamFlag: true` when the optional "Style/title" section is opened — so in
the normal flow the API discards exactly the inputs the user typed. When the section
*is* opened, `style`/`title`/`continueAt` are sent only if non-empty, violating the
required-parameter contract of the `true` mode.

**Fix:**
- Send `defaultParamFlag: true` whenever the user provides a prompt or continueAt.
- In that mode require all four custom params in the UI: default `style`/`title` from
  the source track (`track.tags` / `track.title`) and `continueAt` to the track
  duration when left blank.
- Offer a "Simple extend" path (no prompt) that sends only `audioId` + `model` with
  `defaultParamFlag: false`; relax the Worker's unconditional `prompt` requirement to
  match (prompt required only when `defaultParamFlag` is true).
- Update `test/functions/suno.test.ts` + `test/components/TrackActions.test.tsx`.

### 2. `useTaskPoller` poll-loop race: stale tasks overwrite the new task's state
**File:** `src/hooks/useTaskPoller.ts`

`startPolling` calls `stop()`, which clears the *timer* — but if a poll request is
in-flight, its continuation re-arms `setTimeout(poll, …)` after the await, resurrecting
the old loop alongside the new one. Submitting task B while task A's poll is airborne
leaves both loops running; when A completes, it flips `status`/`result` for B's UI and
pushes A's (wrong) result into history.

**Fix:** add a generation counter (`const gen = ++genRef.current`) captured by each
loop; after every await, bail out if `genRef.current !== gen` (and keep the `alive`
check for unmount). Add a regression test that starts a second poll mid-flight.

### 3. Worker status routes turn transient upstream errors into permanent task failure
**Files:** `functions/api/jobs/[[route]].ts`, `image/[[route]].ts`,
`video/[[route]].ts`, `music/[[route]].ts`, `suno/[[route]].ts` (GET handlers)

None of the five status GETs check `res.ok` before parsing. A kie.ai 429 (documented:
rejected, not queued) or transient 5xx returns an envelope with `data: null`, which
every handler maps to `{ status: "failed" }` — the client stops polling and marks a
*still-running* generation as failed. The frontend's whole `RateLimitError` backoff in
`useTaskPoller` never engages because the Worker swallows the 429.

**Fix:** in each GET, before parsing: forward `429` as HTTP 429 (client already backs
off), and map upstream 5xx / unparseable bodies to HTTP 502 with an error message
instead of a business `"failed"` status. Only report `failed` for a genuine
fail-state or a definitive 4xx business error. Cover with tests (429 → keeps polling,
500 → keeps polling, business fail → failed).

### 4. `/api/validate` accepts invalid keys wrapped in HTTP-200 error envelopes
**File:** `functions/api/validate/[[route]].ts`

kie.ai frequently wraps auth errors as HTTP 200 + `{ code: 401, msg, data: null }`
(the chat route already defends against exactly this). `/validate` only checks
`res.ok`, so such a response yields `{ valid: true, credits: undefined }` — the
KeyModal then reports "Key saved & verified" for a bad key.

**Fix:** parse the envelope's `code`; treat `code === 200` (or a numeric `data`) as
valid, `401/403` codes as `{ valid: false }`, anything else falls through to the chat
probe. Extend `test/functions/validate.test.ts` with the 200-wrapped-401 case.

### 5. KeyModal persists the key before validating it
**File:** `src/components/shared/KeyModal.tsx`

`save()` runs `setApiKey(trimmed)` *then* validates. On rejection the modal shows
"✗ Key rejected" but the bad key stays in localStorage: `hasApiKey()` is true, the
key-prompt guards on every page stop firing, and every subsequent request fails with a
confusing upstream error instead of the key modal.

**Fix:** validate first, persist only on success. Since `validateKey()` reads the
stored key, either (a) let it accept an explicit key parameter threaded through the
`X-KIE-Key` header, or (b) restore the previous key when validation fails. Prefer (a).

### 6. Task-queue indicator is dead code — and can display phantom "running" jobs
**Files:** `src/lib/taskQueue.ts`, `src/components/shared/TaskQueueIndicator.tsx`,
all pages

`enqueueTask` / `updateTaskStatus` are never called anywhere, so the header indicator
never shows live tasks. Worse, `kie.taskQueue` entries persisted by an older build load
as eternally "pending" (nothing ever updates them), showing "N running" forever.

**Fix:**
- Wire the queue into `useTaskPoller`: enqueue on `startPolling` (page/model/prompt
  passed via params or a small options arg) and `updateTaskStatus` on terminal states.
- On store load, mark `pending` entries older than a sane horizon (e.g. 2h) as failed
  so stale state can't stick.
- Add tests for enqueue-on-start / update-on-finish.

---

## P2 — Incorrect behavior in edge cases

### 7. ImagePage sends `size` to every text-to-image model
**Files:** `src/pages/ImagePage.tsx`, `functions/api/image/[[route]].ts`

The `size` select ("512x512"…) is shown and submitted for *all* create-mode models,
but only `gpt-image-2` declares `inputs: ["size"]` in the catalog. Models with strict
input validation can reject the unknown field (the codebase's own rule: "never infer
fields — copy them from each model's doc page").

**Fix:** render the size select and include `size` in the body only when the selected
model's catalog entry has the `"size"` input hint. Verify gpt-image-2's documented
`size` values while touching this.

### 8. MusicPage `lastTask` ref races between the generate and cover pollers
**File:** `src/pages/MusicPage.tsx`

`prepend` tags finished tracks with `...lastTask.current`. Generate (A) and Cover (B)
run on separate pollers and are not mutually blocked — starting B while A polls means
A's tracks get tagged with B's `taskId`/`model`, breaking Stems/WAV/Lyrics/Extend for
those cards (they all send `{ taskId, audioId }`).

**Fix:** keep per-flow task info (e.g. `lastGenTask` / `lastCoverTask` refs, or pass
the task info through the poller result callback) instead of one shared ref.

### 9. Chat SSE parser drops any data line *containing* "[DONE]"
**File:** `src/pages/ChatPage.tsx`

`if (!t.startsWith("data:") || t.includes("[DONE]")) continue;` — an assistant reply
whose streamed delta legitimately contains the substring `[DONE]` is discarded.

**Fix:** strip the `data:` prefix first and compare the trimmed payload for equality
with `[DONE]`.

### 10. PromptBox: deleting a saved prompt doesn't update the list
**File:** `src/components/shared/PromptBox.tsx`

The × button calls `removeSavedPrompt` but never bumps `refreshKey`, so the entry
stays visible until an unrelated re-render. Fix: `setRefreshKey((k) => k + 1)` after
removal (same as the save button).

### 11. Legacy `gpt-4o` chat route sends a wrong model id upstream
**File:** `functions/api/_lib.ts`

`CHAT_ROUTES["gpt-4o"]` points at the gpt-5-2 path but `buildChatBody` forwards
`model: "gpt-4o"` in the body — an id the route may reject. The catalog has no
`gpt-4o` entry, so this is unreachable from the UI but wrong for direct API users.
Fix: remove the entry (or map the body model to `gpt-5-2` if kept for compat).

---

## P3 — Hygiene / hardening (do last, low risk)

12. **`src/lib/throttle.ts`** — `refill()` sets `lastRefill = now` after a `floor`,
    discarding the fractional remainder each call; under steady polling the effective
    refill rate drops below 1 token/500ms. Advance `lastRefill += add * REFILL_INTERVAL_MS`
    instead.
13. **`src/lib/vault.ts` + `ExpiryBadge`** — media saved to the vault is never *read
    back*: `vaultGet` has no call sites, so "saved locally" items still render from the
    (expiring) remote URL. Wire history cards to prefer `vaultGet(url)` when saved.
14. **Suno/Veo/Music failure paths** — `error: data.data.errorMessage` can be
    undefined; default it server-side ("Generation failed") for consistent toasts.
15. **`normalizeStatus`** — confirm `TEXT_SUCCESS`/`FIRST_SUCCESS` intentionally map to
    `pending` (they do today via fall-through; add a comment + test locking that in,
    since `raw === "SUCCESS"` equality is load-bearing).

---

## Execution order

| Phase | Items | Notes |
|-------|-------|-------|
| 1 | 2, 3 | Polling correctness underpins every page; do together, tests first |
| 2 | 4, 5 | Key validation pair — one PR-sized change |
| 3 | 1 | Extend semantics (UI + Worker + tests, doc-verified) |
| 4 | 6, 8 | Task tracking correctness |
| 5 | 7, 9, 10, 11 | Small scoped fixes |
| 6 | 12–15 | Hygiene |

Each phase: implement → `npm run build` (includes `tsc --noEmit`) → `npm test` →
commit. New tests accompany every P1/P2 fix.
