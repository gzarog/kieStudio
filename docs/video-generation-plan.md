# Video Generation — Audit & Implementation Plan

> **Status update (2026-07-17, same day):** Phases 1–4 are implemented on this
> branch, and the findings below were re-verified LIVE against api.kie.ai with
> a user key. Live results: all 43 catalog model ids are recognized by
> createTask **except** the four ByteDance V1 Pro/Lite models, which return
> "Server exception" on every request (removed from the catalog); F1/F2/F5
> were confirmed as real request failures (`wan/2-5` → "duration is required",
> `hailuo/02` → "Invalid parameter", Kling family → missing required
> `sound`/`mode`/`multi_shots`); the fixed payloads for 12 representative
> models + Veo all pass schema validation (blocked only by the test account's
> credit balance, which is too low to run a full generation — Phase 5's paid
> smoke run remains open). Also learned live: kie.ai **charges at task
> creation**, and `grok-imagine/image-to-video` accepts an empty input — the
> UI must keep guarding against accidental submits.

**Date:** 2026-07-17
**Scope:** Every video generation option reachable from the 🎬 Video page — 3 modes
(T2V / I2V / V2V) × 40 catalog models — plus the `/api/video` worker.

**Verdict: video generation is NOT working as expected.** The happy path
(default t2v model, default settings) generates a video, but several option
groups are silently dropped, three catalog models are unreachable, two v2v
models always fail, and the Veo entry generates with the wrong model. All 307
unit tests pass because none of these behaviors are covered by tests.

---

## 1. How the pipeline works today

```
VideoPage.tsx  ── POST /api/video { prompt, model, input? }
                        │
functions/api/video/[[route]].ts
                        │  input = { prompt, ...body.input }
                        ├─ model === "veo-3.1" → POST /veo/generate (dedicated)
                        └─ else                → POST /jobs/createTask { model, input }
                        │
GET /api/video?taskId=…&model=…  → normalized { status, result: { videoUrl } }
```

Per mode, the page sends:

| Mode | Body sent by `VideoPage.generate()` (src/pages/VideoPage.tsx:73-92) |
|------|---------------------------------------------------------------------|
| T2V  | `{ prompt, model, resolution, duration }` — **top level, not in `input`** |
| I2V  | `{ prompt, model, input: { duration: String(duration), <imageField>: url } }` |
| V2V  | `{ prompt, model, input: { <videoField>: url } }` |

---

## 2. Findings

### F1 — T2V `resolution` and `duration` are silently dropped (bug, all t2v models)

The page sends `resolution`/`duration` at the top level of the body
(`src/pages/VideoPage.tsx:88`), but the worker only reads `b.prompt` and
`b.input` (`functions/api/video/[[route]].ts:21-26`). The 720p/1080p and
5s/8s/10s selectors therefore have **no effect for any text-to-video model** —
every t2v task runs with the provider's defaults. Users are being charged for
1080p/10s selections they never receive (or the cheaper default they didn't
expect).

### F2 — Prompt-optional V2V models always fail with 400 (bug)

`wan/2-7-videoedit` and `topaz/video-upscale` are flagged `promptOptional` and
the UI enables Generate with an empty prompt (`src/pages/VideoPage.tsx:68-71`).
But the worker unconditionally rejects empty prompts:
`if (!b.prompt?.trim()) return badRequest("Prompt is required.")`
(`functions/api/video/[[route]].ts:24`). **Topaz Video Upscale and prompt-less
Wan Video Edit can never succeed.** (The same guard exists in the image route
for `recraft/remove-background` etc. — worth checking in the same pass.)

### F3 — Three Hailuo I2V models are unreachable dead entries (bug)

`hailuo/2-3-image-to-video-standard`, `hailuo/02-image-to-video-pro`, and
`hailuo/02-image-to-video-standard` declare `inputs: ["image"]` but have **no
`imageField`** (`src/lib/types.ts:172,175,176`). The I2V picker filters on
`m.imageField` (`ModelPicker.tsx:47`), so they never appear in any picker —
and even if selected, `imageInputFor()` would return `{}` and no source image
would be sent.

### F4 — "Veo 3.1" actually generates with `veo3_fast` (bug, verified against live docs)

The worker forwards `{ prompt, ...input }` to `POST /veo/generate` without a
`model` field. Per the live doc (docs.kie.ai/veo3-api/generate-veo-3-video,
fetched 2026-07-17), the endpoint's `model` param accepts
`veo3 | veo3_fast | veo3_lite` and **defaults to `veo3_fast`**. So the entry
labeled "Veo 3.1" silently runs the fast tier. Additional Veo mismatches:

- `duration` is an **integer enum 4 | 6 | 8** (default 8); the UI offers
  5/8/10 and I2V mode sends it as a **string** (`"5"`), which is the wrong
  type and an out-of-range value.
- `resolution` (`720p | 1080p | 4k`) and `aspect_ratio` (`16:9 | 9:16 | Auto`)
  are supported by the API but never forwarded (see F1) or offered (aspect
  ratio has no UI at all).
- Whether a distinct Veo 3.1 model value exists on kie.ai needs doc
  confirmation (the marketplace pages are network-gated from this
  environment); if only `veo3*` values exist, the catalog label must be
  corrected to keep `verified: true` honest.

### F5 — I2V sends `duration` to every model, valid for almost none (bug/risk)

I2V mode always includes `duration: String(duration)`
(`src/pages/VideoPage.tsx:86`), ignoring the catalog's `inputs` hints. Of the
~20 I2V models, only 5 declare duration support. Consequences:

- Models with a documented duration enum of `"5" | "10"` (Kling family) get
  `"8"` when the user picks 8s → likely a createTask validation failure.
- Models that don't document `duration` at all (ByteDance V1, Grok, Wan
  Flash, HappyHorse, Seedance…) receive an undocumented field — ignored at
  best, rejected at worst.
- Veo gets a string where an integer is required (F4).

### F6 — Option values are global, not per-model (design gap)

`720p/1080p` and `5/8/10s` are hardcoded in the page. Real allowed values
differ per model (Veo: 4/6/8s + 4k; Kling: 5/10s; Hailuo 02: 6/10s numeric;
…). The catalog has `inputs: ["resolution", "duration"]` hints but no
allowed-values/type/field-name metadata, so the UI cannot render correct
controls and the worker cannot validate.

### F7 — Minor issues

- Only `resultUrls[0]` is surfaced; multi-clip results are dropped
  (`functions/api/video/[[route]].ts:83` keeps `resultUrls` in the response
  but `VideoItem` ignores it).
- No aspect-ratio control for any model.
- ~30 Jobs-API video model ids are marked `verified: true` against
  KIE-API-VERIFIED.md but cannot be re-verified from this environment
  (kie.ai/market returns 403 through the proxy); none have ever been
  exercised end-to-end (no smoke test exists, and unit tests only assert the
  proxy plumbing).

---

## 3. Implementation plan

### Phase 1 — Worker correctness (`functions/api/video/[[route]].ts`)

1. Accept generation options inside `input` only; delete the dead top-level
   contract (coordinate with Phase 3 so the page sends `input` for all modes).
2. Relax the prompt guard: allow an empty prompt when `input` carries a source
   media field (or when the catalog marks the model `promptOptional` — pass a
   flag from the client). Fixes F2.
3. Veo: send an explicit `model` value (confirmed from docs — `veo3` vs a
   real 3.1 id), forward `aspect_ratio`, `resolution`, and integer `duration`,
   and set `generationType` implicitly via `imageUrls` as documented. Fixes F4.

### Phase 2 — Catalog options schema (`src/lib/types.ts`)

1. Add per-model option metadata, verified per doc page (never inferred):

   ```ts
   interface ModelOptions {
     duration?:   { field: string; values: (string|number)[] };  // exact enum + type
     resolution?: { field: string; values: string[] };
     aspectRatio?: { field: string; values: string[] };
   }
   ```

2. Populate it for the models whose docs are already verified; leave it off
   (no control rendered, nothing sent) where unverified — sending nothing is
   always safe. Fixes F5/F6 structurally.
3. Fix the three Hailuo I2V entries: look up the documented image field and
   set `imageField`; if it cannot be verified, remove the entries (keeping
   `verified` honest) rather than shipping dead rows. Fixes F3.

### Phase 3 — VideoPage per-model controls (`src/pages/VideoPage.tsx`)

1. Drive the resolution/duration (and new aspect-ratio) selects from the
   selected model's `options` — hide a control the model doesn't support,
   and populate it with the model's real values (reset on model change).
2. Build one code path for all three modes:
   `{ prompt, model, input: { ...optionFields, ...sourceFields } }` — options
   go in `input` with the exact documented field name and type. Fixes F1/F5.
3. Surface all `resultUrls` in history, not just the first (F7).

### Phase 4 — Tests

1. Table-driven contract test: for **every** video catalog entry × capability,
   simulate a submit and assert the exact `createTask` / `/veo/generate`
   payload — field names, value types, and enum membership against the
   catalog's `options`. This makes F1/F3/F5-class regressions impossible to
   reintroduce silently.
2. Regression tests: prompt-less v2v succeeds (F2); Veo body carries
   `model` + integer duration (F4); no `duration` sent for models without it.
3. Catalog lint test: any model with `inputs`/`capabilities` implying an
   upload must have the matching `imageField`/`videoField` (catches F3).

### Phase 5 — Live verification (needs a real kie.ai key — cannot run here)

1. Add `scripts/smoke-video.mjs`: opt-in (`KIE_KEY` env), submits the
   cheapest/shortest variant for each video model, polls to terminal state,
   and prints a pass/fail matrix. Run rate-limit-aware (≤20 req/10s).
2. Use the results to correct any wrong Jobs ids/fields and to flip
   `verified` flags honestly; re-verify the gated marketplace doc pages from
   a non-proxied network at the same time.

### Suggested order & size

| Phase | Fixes | Size |
|-------|-------|------|
| 1 Worker | F1 (server half), F2, F4 | S |
| 2 Catalog | F3, F5/F6 schema | M (mostly doc lookups) |
| 3 Page | F1 (client half), F5, F7 | M |
| 4 Tests | regression net | M |
| 5 Smoke | end-to-end proof | S code, needs user key |

Phases 1–4 land together as one PR (the page/worker contract changes are
coupled); Phase 5 is a follow-up requiring the operator's key.
