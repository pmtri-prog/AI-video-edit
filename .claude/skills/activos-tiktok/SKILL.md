---
name: activos-tiktok
description: Edit a Vietnamese vertical TikTok video (9:16) for Phạm Minh Trí's personal channel that sells ActivOS Events to agencies and FMCG/beauty brand managers. Talking head + real event footage, pastel layer cards (Wow / Consent / Engage), a 3-bar level indicator, BCG source tags. Use when the brief selects skill `activos-tiktok` or Style Design `activos`, or when the user mentions ActivOS, TikTok Beauty Fest, TikTok Food Fest, Dược Hậu Giang, or the BCG maturity series.
---

# ActivOS TikTok - Trí's channel

## 0. Read first (mandatory)

1. **Read `assets/brand/activos/guideline.md` in full before planning anything.** It is the single source of truth for colors, fonts, wording, banned words, numbers and client names. Trí edits that file, not this one. If this skill and the guideline disagree, **the guideline wins**.
2. Then read `noti-tiktok-vn` for PROCESS only: transcription, auto-cut, karaoke caption timing, zoom/punch-in technique, SFX wiring and loudness, draft → verify → final, render contract fixes. **Ignore every visual rule in it**: dark fintech blue, gradient text, glow, glassmorphism, grain, drifting blobs. They are all forbidden on this channel.
3. `video-pipeline` still governs the project layout, `meta.json`, the render queue and QC.

## 1. Precedence

Guideline md (content rules) + TryOh brand pack (visuals) > Style Design `tryoh` > brief notes > this skill > `noti-tiktok-vn`.

Brief notes may hold a **scene sheet** (see section 6). When present, follow it beat by beat: on-screen card text, layer, level and source are the user's words - use them VERBATIM.

## 2. Setup per project

**Visual identity is TryOh! v1.0 (since 12/11/2026).** The story, wording and content rules of the guideline stay; colors and fonts come from the TryOh brand pack in `assets/brand/tryoh/` (`03-mau/mau-tryoh.txt`, `04-chu/font-tryoh.txt`). Nothing ActivOS-branded (Archivo, peach/mint, ActivOS logo) appears on screen, and there is no end card (3.7).

```bash
mkdir -p assets/fonts assets/brand
cp ../../assets/styles/files/tryoh/*.ttf assets/fonts/
```

`@font-face` in EVERY composition file (sub-compositions render in isolation - never rely on `var()` or fonts declared in the master):

```css
@font-face { font-family: "Space Grotesk"; src: url("../assets/fonts/SpaceGrotesk-VF.ttf") format("truetype"); font-weight: 300 700; }
@font-face { font-family: "Be Vietnam Pro"; src: url("../assets/fonts/BeVietnamPro-SemiBold.ttf"); font-weight: 600; }
@font-face { font-family: "Be Vietnam Pro"; src: url("../assets/fonts/BeVietnamPro-Regular.ttf"); font-weight: 400; }
@font-face { font-family: "JetBrains Mono"; src: url("../assets/fonts/JetBrainsMono-VF.ttf"); font-weight: 100 800; }
```

Adjust the relative path to where the composition lives. Verify on the first snapshot that headlines render in Space Grotesk (geometric, open "a", flat-topped "t") with full Vietnamese diacritics - a fallback sans means the font did not load.

## 3. Visual components (literal hex - no CSS variables in sub-compositions)

| Token | Hex |
|---|---|
| hồng nhạt (Wow, level 1) | `#fbd9cb` |
| xanh trời (Consent, level 2) | `#cde4ff` |
| vàng trứng (Engage, level 3) | `#fee4a9` |
| cát (neutral cards, rotation) | `#efe6da` |
| kem (light backgrounds) | `#f6f2ec` |
| đỏ TryOh! (headline final dot, big accent blocks) | `#f43a1c` |
| đỏ đậm (small red text on light) | `#b3260f` |
| mực (all text on light/pastel) | `#1a1a1a` |
| caption pill on footage | `rgba(26,26,26,0.72)` |

Red is an accent, never a text color on footage and never a right/wrong signal.

### 3.1 Level bar (top-left, whole video)
Three pills in a row, hồng · xanh trời · vàng trứng, each 72×10px, radius 5px, gap 8px, at `top: 150px; left: 64px`. The level the current beat talks about is at opacity 1, the other two at 0.3. Beats with no level: all three at 1. Change level with a 0.3s opacity tween only. This replaces any corner logo - **never add a corner logo**.

### 3.2 Layer card (the main on-screen text)
- Solid pastel block in the color of its layer, radius 32px, padding 40px 48px, text `#1a1a1a` only.
- Headline: Space Grotesk 700, 110–150px, letter-spacing -0.02em, line-height 1.0, sentence case. A headline that is a full statement ends with a period in red `#f43a1c` (TryOh signature); a single term ("Nascent") has no period.
- Max one Space Grotesk headline per frame. Max 3 pastel colors per frame.
- Enter: y 40→0 + opacity 0→1, 0.45s `power3.out`. No scale-pop glow, no drop-shadow, no blur.

### 3.3 Number card
Same as the layer card, with the number large (Space Grotesk 700, 200–240px), one meaning line in Be Vietnam Pro 600 at 52px, and a mono label at 30px with date and place, e.g. `TikTok Beauty Fest · 1 ngày`. Vietnamese number format: `5.000+`, `1,5 lần`.

### 3.4 Source tag
A JetBrains Mono 30px label in the caption pill style (`rgba(26,26,26,0.72)`, white text, radius 64px, padding 10px 20px), bottom-left above the caption zone, visible for the whole beat where a BCG term or number appears. Text: `Nguồn: BCG × Google, 2021` or `... 2024`, exactly as in the scene sheet.

### 3.5 Status tag
A feature still in test gets a cát `#efe6da` pill with đỏ đậm `#b3260f` JetBrains Mono text "Đang thử nghiệm".

### 3.6 Captions
- Be Vietnam Pro 600, 52-60px, max 2 lines, white text in the caption pill.
- Active word: underline 6px in the color of the current layer, not a color change, glow or scale.
- Position: `bottom: 420px` (the guideline safe zone keeps all text at least 400px above the bottom edge - do NOT use the 372px from `noti-tiktok-vn`). Keep clear of the top 150px and the right 140px.

### 3.7 No end card
Trí does not want an end card. The video ends on his last spoken line (the closing question) with captions, nothing appended after it - no logo frame, no slogan, no URL card. Do not add one even if the guideline md or an older note asks for it.

### 3.8 Forbidden visuals
Gradients, glow, drop-shadow on text, glassmorphism or backdrop blur, grain, emoji, all-caps text (no `text-transform: uppercase`), white text on any pastel, red or green for right/wrong, stock or AI images, any logo of a client brand unless the brief says it is approved (the TikTok co-branded file in section 4.1 is pre-approved). The TryOh! mascot "Ồ!" (`assets/brand/tryoh/05-mascot/`) is not used on this channel - Trí's decision, even though the brand guideline allows it on TikTok.

### 3.9 Thumbnail (cover) - "Nhãn dán" layout, mandatory for every video
Trí chose this layout on 12/11/2026 for the whole channel. Style Design `tryoh` is flat (no gradient, no glass), so `POST /api/projects/<id>/thumbnail` renders it automatically (`engines/remotion/src/ThumbnailStickers.tsx`): the frame full-bleed, up to 3 keyword pills stuck right above a sand title card, title in Space Grotesk with a red final period.

```json
{"title":"Cấp 1: làm thương hiệu","tags":["Sự kiện","Booth","Nascent"],
 "tagColors":["#fbd9cb","#cde4ff","#fee4a9"],"frameAt":5,
 "sourceRel":"video-projects/<id>/assets/<clip>.cut.mp4"}
```

- `sourceRel` = the clean cut clip (no captions or cards burned in), never the final render.
- `frameAt` = a moment where Trí looks into the lens with eyes open - extract 3-4 candidates and look before choosing.
- `title` 3-7 words, from what he actually says; `tags` = 3 short keywords (≤ 14 chars each), none from the banned list.
- The pills sit on the chest above the card and must never cover the face. Check the PNG; if the face is low in the frame, pick another `frameAt`.

## 4. Footage rules
- Source: the **TryOh library** - a catalog of Trí's Google Shared Drive "TryOh!E vent Media" (one subfolder per event; the folder name is the `event` tag). The backend cannot read Drive; clips are downloaded on demand through Trí's Chrome and registered with `node scripts/media-library-register.mjs <driveId> <file>`, which moves the file out of `~/Downloads` and records its sha256.
- When the brief has **"Kho TryOh" ON** (`brief.brollLibrary`): find clips with `GET /api/media-library?q=…` / `?event=…&downloaded=1`, then `POST /api/media-library/<id>/stage {"projectId":"<id>"}` and reference the returned `relPath`. Stage skips duplicates by hash - never copy footage by hand. A clip you need that is not downloaded yet: keep the talking head there and list `id`, `title` and the line it should cover in the report.
- When it is **OFF**: use only what is already in the project's `assets/`; stage returns 409 BROLL_DISABLED.
- After you look at a staged clip, write what you saw back so the library gets smarter: `PATCH /api/media-library/<id> {"tags":{"shot":"wide|crowd|hand|product|machine|screen|other","faces":"none|far|recognizable","description":"…","brands":["…"]}}`. Do not set `approved` - that is Trí's call.
- Only real footage from `assets/`. `autoIllustrations` must be off - if the brief has it on, stop and ask.
- Consumer faces must not be recognizable: prefer wide, from-behind or hand close-ups. If a usable clip shows a face, blur it (`filter: blur(18px)` on a tracked region, or crop) and say so in the report.
- Blur every visible name or phone number on machine screens.
- Zoom technique from `noti-tiktok-vn` applies, but slow and rare: 1 punch-in every 6-10s, scale 1 → 1.08 max (guideline section 5), no snap or shake.

### 4.0 Cutaways
When the brief has "Cảnh trám minh họa" ON, follow the `filler-scenes` skill: real footage first, then a screen recording of tryoh.vn (published projects and numbers there are approved proof), then a motion graphic in the TryOh! palette. Run `node scripts/layout-qc.mjs video-projects/<id>` before every draft.

### 4.1 Partner proof - TikTok sampling partner (mandatory)
Trí wants credibility on screen every time he claims the TikTok partnership. Whenever the transcript mentions it - "đối tác sampling", "sampling partner", "đối tác của TikTok", "TikTok Beauty Fest", "TikTok Food Fest", "BeautyFest", "FoodFest" (match accent-insensitive, any casing) - put proof on screen from that word for 2-4s. Pick the first that exists, in this order:

1. **Co-branded logo** "TikTok BeautyFest × TryOh!" - the file from the TryOh brand pack, folder `06-doi-tac/`, kept locally at `assets/brand/tryoh/06-doi-tac/tiktok-beautyfest-x-tryoh.png` (black text on transparent - light background only). Copy it into the project's `assets/` first (Remotion only stages files inside the project). Show it on a cream `#f6f2ec` card, centered, width 640-760px, fade in 0.3s, no other logo in the same frame. Beauty Fest only: **Food Fest has no co-branded logo** - for Food Fest write the line as text instead (step 3) or use photos (step 2).
2. **Real event photos/footage** from the TryOh library, matching the event that is named: `GET /api/media-library?q=TBF` (events "TBF …", "Beauty Summit") or `?q=Foodfest`, then stage as in section 4. Only when `brief.brollLibrary` is ON. Not downloaded yet → list `id` + `title` in the report so Trí can download it, and fall through to step 3.
3. **Text line** on a layer card, verbatim: `Đối tác sampling của TikTok Beauty Fest và TikTok Food Fest 2026` (or only the event that was named), mono label with the year.

Never: draw, redraw, recolor or retype the TikTok logo; build a new "TikTok × TryOh!" lockup yourself; fetch the TikTok logo from `/api/brand-logos` for this claim (a bare TikTok logo reads as an endorsement that was not given - only the approved co-branded file may carry it); say "partner of TikTok" without naming the event. A co-logo is a logo, not b-roll, so step 1 is allowed even when "Kho TryOh" is OFF. Report every proof moment as `mm:ss | what was shown | source file`.

## 5. Content QC (mandatory, after the draft, before final)
Run on `assets/transcript.final.json` and every `compositions/*.html`:

```bash
grep -inE "giải pháp toàn diện|đột phá|hàng đầu|tối ưu hoá trải nghiệm|tối ưu hóa trải nghiệm|tốt nhất|rẻ nhất|duy nhất|số một|số 1|đầu tiên|100%|tự hào|inbox báo giá|comment để nhận|giá vốn|biên lợi nhuận|đơn giá|báo giá|chi phí nội bộ|lead|thu data|data khách|pixel|capi" assets/transcript.final.json compositions/*.html
```

- "Nhất" in a plain description ("giờ đông nhất", "chọn nhiều nhất") is fine; superlative claims about ActivOS are not.
- Any hit in on-screen text → fix it before final. A hit in the spoken transcript → list it in the report for Trí to decide (do not silently cut his speech).
- Every number on screen must have a date or a place next to it. List any that do not.
- Every client or event name on screen must be in the approved list in the guideline (section 9). Unapproved → replace with the industry description from the guideline.
- Check the frames: no white text on pastel, no all-caps, level bar shows the right level per beat.
- Report the result as a table: check | pass/fail | what was done.

## 6. Scene sheet format (brief notes)

Trí's brief notes may contain lines like:

```
[00:00-00:03] lop=wow cap=1 the_chu="5.000+ mẫu · 1 ngày" nhan="TikTok Beauty Fest" nguon=-
[00:20-00:32] lop=consent cap=2 the_chu="Emerging" nguon="BCG × Google, 2024"
```

- `lop`: wow → hồng nhạt, consent → xanh trời, engage → vàng trứng, none → cát or no card.
- `cap`: which pill of the level bar is lit (1/2/3, `-` for all).
- `the_chu`: card headline, verbatim. `nhan`: mono label. `nguon`: source tag text or `-`.
- Times are approximate: snap each beat to the nearest word in the transcript where the idea starts.
- If there is no scene sheet, derive beats from the transcript and the guideline's video formula (section 6 of the guideline), and present the beat table for approval before building.

## 7. Report checklist (in addition to `video-pipeline`)
- [ ] Guideline md was read this session (say so in the report)
- [ ] Fonts loaded from `assets/fonts/` (Space Grotesk visible on a snapshot)
- [ ] No corner logo and no end card
- [ ] Every TikTok partner mention has proof on screen (section 4.1), listed with timestamp and source
- [ ] Thumbnail made with the "Nhãn dán" layout (3.9), face clear of pills
- [ ] Content QC table included
- [ ] Any face/name/number blurred is listed with its timestamp
