---
name: filler-scenes
description: Explainer cutaways for talking-head videos - pick the 2-4 hard-to-picture lines and cover the speaker for 3-8s with a real screen recording (Playwright, POST /api/projects/:id/screen-capture) or a word-synced HyperFrames motion graphic, then run the layout QC script before every draft. Read when the brief has "Cảnh trám minh họa" (fillerScenes) ON, or the user asks for b-roll, cutaways, motion graphics or screen recordings inside a video.
---

# Filler scenes - cutaways that make a line easy to picture

A cutaway replaces the speaker's face for a few seconds while the **voice and captions keep running**. It exists to make one idea visible, not to decorate.

## 1. Pick the moments

- Read `assets/transcript.final.json`. Mark lines that are a **process, a flow (A → B → C), a comparison, a number, a named tool or a real proof** ("we were sampling partner of TikTok Beauty Fest").
- 2-4 cutaways per video, each **3-8s**, total **≤ 25%** of the runtime. Never two cutaways back to back - the face must return in between.
- Snap start/end to word timestamps: start on the first word of the idea, end 0.3s after its last word.
- A scene sheet in the brief notes wins over your own choice.

## 2. Pick the kind - real first

| What the line is about | Use |
|---|---|
| Real event, booth, machine, people (footage exists in `assets/` or the TryOh library) | **Footage** - see the `activos-tiktok` skill section 4 |
| Something that exists on a web page: published project, number, product page, a tool viewers know | **Screen recording** (section 3) |
| A concept or process with nothing real to show: consent in 5s, maturity levels, data flow, before/after | **Motion graphic** (section 4) |

Never invent data. Values in a motion graphic are masked (`••••`) or come verbatim from the transcript/guideline.

## 3. Screen recording (Playwright)

```bash
curl -s -X POST localhost:6869/api/projects/<id>/screen-capture \
  -H "content-type: application/json" -H "x-aiev-token: $TOKEN" \
  -d '{"url":"https://tryoh.vn","focusText":"TikTok Beauty Fest","endText":"TikTok Food Fest 2026","seconds":3.5,"name":"tryoh-su-kien"}'
```

- Returns a job (202); poll `GET /api/jobs/<jobId>` until `done`, then use `outputPath` (`video-projects/<id>/assets/screen/<name>.mp4`, 1080x1920, 30fps, no audio).
- `focusText` = text on the page to scroll to (the FIRST element containing it - pick a phrase unique to the block you want), `endText` = where to finish (omit = gentle drift around focusText; omit both = whole-page tour). `seconds` 2-15. `blurSelectors` = CSS selectors to blur (names, phone numbers).
- Errors: `409 FILLER_DISABLED` (switch off - do not retry), `403 SITE_NOT_ALLOWED` (host not in `assets/screen-capture-sites.json` - list the URL in the report, never work around it), job failed with `Không thấy chữ` (focusText not on the page - read the page text and retry once).
- Place it **full frame with a 20px white border**, below the captions:

```html
<div id="sc1" class="filler" data-layer="bg" style="position:absolute;inset:0;z-index:5;background:#fff;opacity:0">
  <div style="position:absolute;inset:20px;border-radius:36px;overflow:hidden">
    <video data-start="5.2" data-duration="3.5" data-track-index="2" src="assets/screen/tryoh-su-kien.mp4"
           muted playsinline style="width:100%;height:100%;object-fit:cover"></video>
  </div>
</div>
```
```js
tl.to("#sc1",{opacity:1,duration:0.2},5.2).to("#sc1",{opacity:0,duration:0.2},8.5);
```

## 4. Motion graphic (HyperFrames)

Start from `references/mg-form-timer.html` (form being filled word by word + 5s countdown + consent card). Same building blocks for other patterns: flow A → B → C with dashed arrows, level ladder, two-column compare, ticking checklist, big-number card.

- **Flat style**: solid shapes, rounded cards (radius 32-36px), dashed arrows, simple line icons. No gradients, glow, shadows, 3D, emoji. Colors and fonts come from the project's Style Design only.
- **Layout**: one full-frame container `class="filler" data-layer="bg"` filled with the style's background color, `z-index` above the face video and **below the captions** (captions sit at `z-index:7`+ - keep them on top). Every card/label inside gets `data-layer="ui"`.
- **Sync to words**: each element appears on the word that names it (`tl.to(el, …, wordStart)`), not on a fixed rhythm. Enter 0.3-0.5s `power3.out`; container fades 0.2-0.25s in and out.
- Keep the level bar and captions continuous - the cutaway sits between them, it does not replace them.

## 5. Layout QC - before every draft render (mandatory)

```bash
node scripts/layout-qc.mjs video-projects/<id>
```

- Seeks the GSAP timeline every 0.1s and checks every visible `[data-layer="ui"]` element: inside the TikTok safe zone (top 150px, bottom 400px, right 140px) and not overlapping another ui element. ~1.5s for a 100s video.
- Exit 0 = pass, 2 = issues (printed with time range), 1 = could not run.
- Tag your layers: overlay text/cards `data-layer="ui"`, full-frame media `data-layer="bg"`. Untagged compositions fall back to `.cue, .card` with a warning.
- Fix every issue and re-run before rendering. Report the final QC line in the video report.

## Known issues

- **Symptom:** screen recording fills only the top-left corner, rest grey. **Cause:** Playwright `recordVideo` records in CSS pixels. **Fix:** already solved in `scripts/screen-capture.mjs` (frame-by-frame screenshots at deviceScaleFactor 2 piped to FFmpeg) - do not switch back to recordVideo.
- **Symptom:** captions look dimmed or vanish during a cutaway. **Cause:** cutaway composited on top of the finished video. **Fix:** build cutaways inside the composition, under the caption layer - never overlay them on the render with FFmpeg.
- **Symptom:** a card overflows the right edge by 20-80px and gets hidden behind TikTok's like/comment buttons; it is easy to miss when eyeballing frames. **Fix:** trust `layout-qc.mjs`, not a visual check.
