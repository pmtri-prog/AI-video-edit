---
name: activos-tiktok
description: Edit a Vietnamese vertical TikTok video (9:16) for Phạm Minh Trí's personal channel that sells TryOh! to agencies and FMCG/beauty brand managers. Talking head + real event footage, pastel layer cards (Wow / Consent / Engage), a 3-bar level indicator, BCG source tags. Use when the brief selects skill `activos-tiktok` or Style Design `activos`, or when the user mentions TryOh!, ActivOS, TikTok Beauty Fest, TikTok Food Fest, Dược Hậu Giang, or the BCG maturity series.
---

# TryOh! TikTok - Trí's channel

**The channel brand is TryOh! only (Trí, 14/11/2026).** ActivOS never appears on screen, in the voice-over or in the caption. The skill id `activos-tiktok`, Style Design `activos` and folder `assets/brand/activos/` keep their names only because code depends on them.

## 0. Read first (mandatory)

1. **Read `assets/brand/activos/guideline.md` in full before planning anything.** It is the single source of truth for colors, fonts, wording, banned words, numbers and client names. Trí edits that file, not this one. If this skill and the guideline disagree, **the guideline wins**.
2. Then read `noti-tiktok-vn` for PROCESS only: transcription, auto-cut, karaoke caption timing, zoom/punch-in technique, SFX wiring and loudness, draft → verify → final, render contract fixes. **Ignore every visual rule in it**: dark fintech blue, gradient text, glow, glassmorphism, grain, drifting blobs. They are all forbidden on this channel.
3. `video-pipeline` still governs the project layout, `meta.json`, the render queue and QC.

## 1. Precedence

Guideline md (content rules) + TryOh brand pack (visuals) > Style Design `tryoh` > brief notes > this skill > `noti-tiktok-vn`.

Brief notes may hold a **scene sheet** (see section 6). When present, follow it beat by beat: on-screen card text, layer, level and source are the user's words - use them VERBATIM.

### 1.1 Never cut Trí's content to hit a length (mandatory)
The guideline's "40-60s" is a target for NEW scripts, not a reason to trim a recording. A story video (incident, backstage, Q&A, collab) may run to about 2 minutes (guideline section 5, approved 14/11/2026). On an existing take, remove only silences, fillers, stutters and clearly repeated or misspoken sentences (the auto-cut job + dead-weight review). **Never drop the opening hook question, a whole idea, a level's explanation or the closing question.** If the result is still long, say so in the report and let Trí decide - do not cut it yourself.
- **Symptom:** viewers say the video "starts in the middle" and makes no sense. **Cause:** an edit trimmed 115s to 53s and removed the 20s opening question so the video began with "cái câu trả lời…". **Fix:** compare `transcript.final.json` with `transcript.cut.json` before the draft - the first sentence must match and the kept word count should be ≥ 85% unless Trí approved the cuts.

### 1.2 Negative content never uses a real brand as the example (RED FLAG, Trí 16/11/2026)
When a line covers law breaking, data violations, loopholes, game hunters, wasted budget or bad practice, nothing near it may name or show a real brand: no name, logo, event footage or photo, credit, thumbnail tag or caption. Putting them side by side tells the viewer that brand did it wrong. Keep negative examples generic ("một số sự kiện", "nhiều nhãn"). A brand's name and footage may only sit on positive lines: TryOh as partner, good results, the right way to do it.
- **Symptom:** a lessons video read as an accusation against a client. **Cause:** video 6 v4 opened with "không phải thu data nào cũng đúng luật" over the Ngày hội Biofermin (Dược Hậu Giang) stage, and its thumbnail read "AEON Bình Tân · Dữ liệu đúng luật". **Fix:** before every draft, check each insert, credit, burned-in card, spoken brand mention and the thumbnail against the topic of the line it sits on. On a negative topic, drop the brand or swap in TryOh's own booth footage.

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

### 3.9 Thumbnail (cover)

**Real event photo first** (Trí, 14/11/2026: a real photo reads as more credible). When the video is about an event or place and a real photo of it exists (venue, stage, booth with the TryOh! machine), the cover is that photo, full-bleed, plus a headline that names the claim, the event and the place, e.g. "Lỗ hổng kinh tế ở Foodexpo, SECC quận 7" over a photo of SECC. Stage the photo into the project's `assets/` and pass it as `sourceRel` with `frameAt: 0` (ffmpeg reads a still the same way; check the PNG). Same rules as below: Space Grotesk title, consumer faces not recognizable, text inside the centre 3:4 area so the profile grid does not crop it.

**"Nhãn dán" layout** - the fallback when there is no real photo for the topic (e.g. a pure talking-head explainer). Trí chose this layout on 12/11/2026 for the whole channel. Style Design `tryoh` is flat (no gradient, no glass), so `POST /api/projects/<id>/thumbnail` renders it automatically (`engines/remotion/src/ThumbnailStickers.tsx`): the frame full-bleed, up to 3 keyword pills stuck right above a sand title card, title in Space Grotesk with a red final period.

```json
{"title":"Cấp 1: làm thương hiệu","tags":["Sự kiện","Booth","Nascent"],
 "tagColors":["#fbd9cb","#cde4ff","#fee4a9"],"frameAt":5,
 "sourceRel":"video-projects/<id>/assets/<clip>.cut.mp4"}
```

- `sourceRel` = the clean cut clip (no captions or cards burned in), never the final render.
- `frameAt` = a moment where Trí looks into the lens with eyes open - extract 3-4 candidates and look before choosing.
- `title` 3-7 words, from what he actually says. **Prefer a question** (approved 14/11/2026, learned from Khánh LifeTech whose covers are all questions): "Tại sao máy chụp ảnh cạnh máy phát mẫu?" A question title ends with "?" and has no red period; only a statement title gets the red period.
- `tags` = 3 short keywords (≤ 14 chars each), none from the banned list.
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

- "Nhất" in a plain description ("giờ đông nhất", "chọn nhiều nhất") is fine; superlative claims about TryOh! are not.
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

## 6.1 Hook formulas (approved by Trí 14/11/2026)

Benchmarked on @khanh.lifetech (TikTok, 46 videos read with their auto-captions). His million-view videos open with **something that sounds wrong or a question with no answer yet**. His flops open with the solution's name ("biến bất kỳ điều hòa nào thành…") or a diary line ("ngày đầu tiên của mình ở…"). On this channel the flop version is "TryOh! giúp nhãn…". Designed thumbnails did not move his views (his designed-cover series got 5-7K while plain-frame covers got millions), so the hook decides reach and the cover only polishes the profile grid.

**Every script carries one surprising claim, and the video opens on it** (Trí 16/11/2026). A flat statement that sounds wrong or too small to matter ("Cấp 1 và cấp 2 chỉ khác nhau đúng 5 giây"), not a question and not a topic title. The question comes after the claim, still inside the first 10s. Evidence: same stage-photo opening, claim 58% left at 2s vs question 50% (BCG parts 2 and 3). When reviewing a transcript or writing a re-shoot script, name the claim line; if there is none, write one from what Trí actually says and flag it for his approval.

The hook line is spoken as voice-over on the 0-3s shot (guideline section 6: never open on Trí's face). Use one of these seven. The Vietnamese lines are the approved wording and can be adapted to the transcript:

| # | Formula | Line for Trí | 0-3s shot |
|---|---|---|---|
| 1 | Made hard on purpose | "Trong máy phát mẫu của mình có một bước mà mình cố tình làm cho chậm đi 10 giây." → the ~10s consent step | hand close-up on the verify screen, numbers blurred |
| 2 | "Why" an odd detail | "Ở TikTok Food Fest, tại sao mình lại đặt máy chụp ảnh ngay cạnh máy phát mẫu?" | wide shot of the two machines side by side |
| 3 | Big number, then a hard question | "Hơn 5.000 mẫu trong một ngày ở TikTok Beauty Fest. Nhưng câu hỏi khó nhất lại đến vào ngày hôm sau." | number card `5.000+` · `TikTok Beauty Fest · 1 ngày` over crowd footage |
| 4 | "For those who think they know" | "Ai làm sự kiện lâu chắc nghĩ phát mẫu thì có gì đâu mà phải nghĩ. Mình cũng từng nghĩ thế." | setup time-lapse |
| 5 | A personal annoyance | "Mình không thích cái cảnh dọn booth xong là mọi thứ biến mất theo." → Engage | pack-down shot |
| 6 | Reply to a comment | "Trả lời anh [tên]: máy chụp ảnh ở sự kiện thì liên quan gì đến dữ liệu cho nhãn?" | TikTok comment sticker over machine footage. **Only with a real comment.** |
| 7 | Backstage or incident | "[Giờ], [ngày] ở [nơi], máy của mình [sự cố thật]. Đây là cách mình xử lý." | incident shot. **Fill only with a real incident from Trí. Never invent one.** |

Rules:
- The paradox is always about Trí's own machine or experience, never about how brands or other agencies do it wrong (guideline 7). Rejected example: "Phát 10.000 mẫu mà brand không biết ai đã nhận?" It criticizes brands and uses an unapproved number.
- Numbers only from guideline section 9, plus one exception for money (changed by Trí 14/11/2026, after the Foodexpo SECC video): **a concrete amount seen at the event ("200k") is allowed as the hook**. It makes people curious, and the body then explains it. The amount must be something Trí really saw at the event, with the event and place named. It must never be TryOh's own price, cost or margin: the content QC grep in section 5 still applies. Khánh's personal income hooks are still not portable.
- **Formula 8 - an economic loophole at a live event** (approved by Trí 14/11/2026): "[Một lỗ hổng kinh tế / con số lạ] ở [sự kiện đang diễn ra], [nơi]", e.g. at Vietnam Foodexpo, SECC quận 7. Tie it to an event that is on now or just ended (guideline 6B, news-following). The first Foodexpo post with this hook got good likes and kept being pushed (~200 views and still rising on 14/11); its retention is not conclusive yet.
- If a transcript's first sentence matches none of the seven and reads like a solution name or a diary line, flag it in the beat table and propose the closest formula. Do not rewrite Trí's spoken words yourself. A new hook means a re-record, and that is his call.

## 6.2 What this channel's own numbers say (TikTok Studio, read 14-16/11/2026)

First three posts (more rows added 16/11). Each got a test batch of ~500-600 For You viewers (97%+ of views) and then stopped within 4-6 hours. TikTok did not widen any of them, and the retention curve shows why: the big drop is at 0-1s.

| Video | Opens on | Length | Left at 2s | 5s | 10s | Watched full |
|---|---|---|---|---|---|---|
| Foodexpo bottle opener | hand doing the thing | 26s | **68%** | 45% | 27% | 10.5% |
| Tommy/Coach mirror | Trí's face | 89s | 47% | 27% | 15% | 3.5% |
| BCG level 1 (first cut) | sand text card | 114s | **33%** | 17% | 8% | 0.5% |
| Lỗ hổng kinh tế FoodExpo | Trí's face | 124s | 46% | 20% | 16% | 0.8% |
| BCG level 1 v5 | sand text card | 63s | 31% | 14% | 9% | 2.3% |
| BCG part 2 | stage photo + claim hook ("chỉ khác nhau đúng 5 giây") | 97s | **58%** | 25% | 9% | 1.4% |
| BCG part 3 | TryOh booth stage + question | 70s | 50% | 25% | 12% | 2.5% |

Rules this adds (the first is confirmed; the rest stay hypotheses until a second batch confirms them):
- **Frame 0 is a real shot already in motion, and it must be a wow moment** (something happening that makes people stop: a machine working, a crowd, a hand doing the thing). Confirmed by Trí 15/11/2026 after the second batch: real shot 68% at 2s, face 46-47%, text card 30-33%. A photo with text on it is boring, and Trí's face reading to camera is boring too - neither opens a video. **Revised 15/11/2026 (BCG level 1 v5, read at 3.5h - re-check at 24h):** the v5 cut opened on the TikTok BeautyFest stage photo (colourful, LED wall, slow pan) with a curiosity line and beat the target, so the opener is "a lively real event scene - a clip, or a busy real photo with a pan - plus a hook line that makes a curious claim or asks an open question". Still banned at frame 0: a text card on a plain background, and Trí's face reading to camera. A clip still beats a photo when one exists. If a recording has no real event footage or photo for its topic, say so in the report and ask before editing.
- **Pulling the hook forward from a finished render** (BCG level 3 v5, 15/11/2026): when only the rendered take exists, lift the strongest 3-4s question from the body (e.g. "các bạn đã biết thu data gì ở cái sự kiện hay chưa" at 46s) into a `hook` scene in front of the full take, and cover it with full-frame event photos so the burned-in face/caption is hidden; redraw its captions via `meta.captions`. Cut to the TikTok × TryOh! proof (co-branded card on the booth photo, section 4.1) on the event word. When a full-frame cutaway sits on top of burned-in captions, end it with `transitionOut: "cut"` exactly where the burned cue changes (check frames) and redraw every word under it - a fade lets the old caption show through and doubles the text.
- **Cover every concrete noun with what it names.** The steady fall from 2s to 10s happens on talking-head stretches. When Trí says "booth", "máy", "sự kiện", "sân khấu" or an event name, cut to a real photo/clip of that thing for 2-4s (same order of sources as section 4.1). In v4: "booth activation…" at 8.6-11.8s → booth photo with the machine. When the cutaway hides burned-in captions, redraw them in the caption style (section 3.6) - never leave the line uncaptioned.
- **Retention without engagement still stalls.** Foodexpo held best but had 0 likes/shares/saves and was not widened either. Put the real question in the first 10s (not only at the end) and tell Trí to pin a comment and reply during the first hour, while the test batch is running.
- **Average watch sits at 8-9s whatever the length** (63-124s, 8 posts). A longer cut buys no extra watch time, so the point and the question must land inside the first 8-10s; everything after is for the few who stay.
- **A claim hook beats a question hook** (adopted as a rule by Trí 16/11/2026, section 6.1; evidence is still one pair): the same kind of stage photo held 58% with "Cấp 1 và cấp 2 chỉ khác nhau đúng 5 giây" and 50% with a question. Open on a surprising statement, ask the question after.
- **A numbered series builds engagement:** BCG part 1 → 2 → 3 got 5 → 10 → 22 likes and the first comment, and "personal profile" grew to ~3% of views (people going back for the earlier parts). Keep "Phần N/5" on screen and in the caption.
- **Every post stalls at ~500-650 TikTok views** (8 of 8 by 16/11). Retention alone has not widened any of them; there are only 3 comments and 3 follows in total. Engagement in the first hour is the missing lever.
- **YouTube differs:** views arrive in the first hours and then stop (BCG part 2: 448 by 3.5h, still 448 at 24h). A wordless clip that held best on TikTok (bottle opener) got swiped away 90% on YouTube, so YouTube needs the spoken point, not just the visual.
- **Length:** at 89-114s almost nobody reached the second half, so the closing question was never seen. This is in tension with the 2-minute allowance for story videos in guideline section 5 (Trí's call 14/11/2026) - do not override it, but when a story cut runs past 60s, quote this table in the report.
- Booth cutaways confirmed by Trí on the BCG v4 re-cut (14/11/2026): "thêm các cảnh chèn booth thì thấy ok hơn". Keep doing them.
- Every post is measured at 24h and 7 days: views, avg watch time, % left at 2s/5s/10s, posting hour. Compare the new video with the table above in the report.

## 6.3 External channel review (Nguyễn Chí Bình, 18/11/2026 - 12 videos, 12-18/11)

Data from Creator Data Hub (auto-captions + engagement). Totals: ~4,750 views, 79 likes, 3 comments, 2 shares, 11 saves (like/view ~1.7%). Nothing escaped the ~600-view test batch. Lessons for the edit:

- **Nobody knows who is talking.** The channel speaks like an expert but has no video saying who Trí is. The strongest proof (TikTok Beauty Fest / Food Fest sampling partner, 5,000-10,000 samples a day - guideline section 9) sat at second 9 of one video. When a transcript contains this credential, move it into the first 10s with the partner proof card (section 4.1) - never bury it mid-body. If Trí records a self-introduction story, treat it as a story video (section 1.1: up to ~2 min, no trimming of ideas).
- **Personal story beats lecture.** "Lỗ hổng kinh tế tại FoodExpo" (Trí collected the gift twice to test the booth) was the only first-person story and one of the 2 shared videos. The BCG lectures read as flat. In the beat table, mark the moment Trí is *doing* something (at the event, testing, reacting) and give it the cutaway and the hook.
- **Jargon that ASR mishears is jargon viewers mishear.** TikTok's auto-captions turned CRM into "C i M", remarketing into "remoting", mapping into "măt pin". In our burned captions: fix every English term against the transcript frame by frame (same check as dates in section 7), and when Trí says CRM/CDP/first-party data with no plain-Vietnamese example, flag it in the report for a re-shoot line - do not invent the explanation in his voice.
- **Fillers ("cái", "ờ") still too dense.** Run the auto-cut dead-weight review on every take and report the filler count left in the first 10s.
- **Every number needs a visible source.** "Tương tác gấp 4,37 lần" and "doanh thu gấp 2 mỗi cấp (BCG × Google)" ran with no source on screen. Every spoken number gets a source tag (section 3.4) while it is on screen; no source known → list it in the report as unsourced, do not ship silently.
- **No sales CTA before the channel has an intro video.** "Liên hệ với chúng mình" landed when viewers did not know who "chúng mình" is. Drop such lines in the cut and say so in the report (guideline section 7 already bans sales CTAs).
- **Series must look like a series.** BCG parts 1-2 showed "Phần 1/5", "Phần 2/5" but levels 3 and 4 did not, and unrelated posts (bottle opener, running in Sala) went out in between. Every series part gets "Phần N/5" on screen, on the cover and in the caption; in the report, warn if an unrelated post is scheduled between two parts.
- **The 16/11 drop is not explained yet.** Views fell ~600 → ~110 per video from 16/11. The reviewer guessed "no speaker / AI-built", but the projects behind those posts (`google-form-o-booth-3-rui-ro`, `photobooth-xac-thuc-nhan-biet-ai`, …) are cuts of Trí's real recordings - the reviewer read only caption data and flagged it as a hypothesis. TikTok Studio read on 19/11 contradicts the guess: the 16-18/11 posts hold viewers about as well as the earlier ones (left at 2s 39-56%, avg watch 7.8-8.7s; Sala 56%, game hunter 11.1s - the channel's best avg watch), so the content did not get worse to watch. What shrank is the **test batch itself**: ~100-130 For You views instead of ~500-600, with 96%+ still from For You. The cut is in distribution, not retention. Open candidates: 7 posts in 3 days (two a day since 14/11), early posts with near-zero engagement lowering the account's starting batch, and very long cuts (BCG part 4 2:36 at 3.95s avg, Sample Partner tips 4:59 at 6% left by 10s). The game-hunter post (18/11 19:59) is climbing again (354 views at ~16h). Until Trí decides, keep his voice audible from 0s and keep face time in the body (the 0-3s opener stays a real scene, guideline section 6).
- **Testing (Trí 19/11/2026): more of Trí's face in the body.** The 0-3s opener stays a real scene; after it, Trí talking to camera is the default shot and cutaways cover only concrete nouns (2-4s each) - no long stretches of app screen recordings over his voice. In the report, give the share of 3s-end where his face is on screen, so the test can be read against the ~600 vs ~110 view gap. Not a fixed rule until the numbers come back.

## 7. Report checklist (in addition to `video-pipeline`)
- [ ] Guideline md was read this session (say so in the report)
- [ ] Fonts loaded from `assets/fonts/` (Space Grotesk visible on a snapshot)
- [ ] No corner logo and no end card
- [ ] Every TikTok partner mention has proof on screen (section 4.1), listed with timestamp and source
- [ ] Thumbnail per 3.9: real event photo + headline with event and place when one exists, else "Nhãn dán" with the face clear of pills
- [ ] Content QC table included
- [ ] Hook checked against section 6.1 (which formula, or flagged as weak)
- [ ] The script has one surprising claim, spoken over the 0-3s shot, with the question after it (section 6.1)
- [ ] Frame 0 is a real moving shot, and every concrete noun has a cutaway (section 6.2), listed as `mm:ss | word | shot`
- [ ] Posting caption suggested: one line restating the hook + the fixed hashtag set from guideline section 6 (`#tryoh #learnontiktok #sukien #sampling`, max 2 extra). If the recording holds two ideas, propose a Part 1 / Part 2 split instead of cutting one
- [ ] Any face/name/number blurred is listed with its timestamp
- [ ] Section 6.3: credential in the first 10s when spoken, every number has an on-screen source, English terms correct in captions, no "liên hệ với chúng mình" CTA, series parts carry "Phần N/5"
- [ ] Every spoken date and number checked on the burned-in caption frame by frame. ASR wrecks Vietnamese dates: "1/1/2026" came out as "1, 8, 1, hay 0, hay 6, hay 0" (BCG part 2, 14/11/2026). Fix with an overlay pill in the caption style, never leave it
- [ ] Do not split a long continuous talk into a series by cutting it apart: Trí judged the result choppy (video-6, 14/11/2026). A recording with several ideas gets a re-shoot script, one idea per take; cutting is only for dead weight inside one take
