---
name: activos-tiktok
description: Edit a Vietnamese vertical TikTok video (9:16) for Phạm Minh Trí's personal channel that sells ActivOS Events to agencies and FMCG/beauty brand managers. Talking head + real event footage, pastel layer cards (Wow / Consent / Engage), a 3-bar level indicator, BCG source tags and an ActivOS end card. Use when the brief selects skill `activos-tiktok` or Style Design `activos`, or when the user mentions ActivOS, TikTok Beauty Fest, TikTok Food Fest, Dược Hậu Giang, or the BCG maturity series.
---

# ActivOS TikTok - Trí's channel

## 0. Read first (mandatory)

1. **Read `assets/brand/activos/guideline.md` in full before planning anything.** It is the single source of truth for colors, fonts, wording, banned words, numbers and client names. Trí edits that file, not this one. If this skill and the guideline disagree, **the guideline wins**.
2. Then read `noti-tiktok-vn` for PROCESS only: transcription, auto-cut, karaoke caption timing, zoom/punch-in technique, SFX wiring and loudness, draft → verify → final, render contract fixes. **Ignore every visual rule in it**: dark fintech blue, gradient text, glow, glassmorphism, grain, drifting blobs. They are all forbidden for ActivOS.
3. `video-pipeline` still governs the project layout, `meta.json`, the render queue and QC.

## 1. Precedence

Guideline md > Style Design `activos` > brief notes > this skill > `noti-tiktok-vn`.

Brief notes may hold a **scene sheet** (see section 6). When present, follow it beat by beat: on-screen card text, layer, level and source are the user's words - use them VERBATIM.

## 2. Setup per project

```bash
mkdir -p assets/fonts assets/brand
cp ../../assets/styles/files/activos/*.ttf assets/fonts/
cp ../../assets/brand/activos/activos-ngang.svg ../../assets/brand/activos/activos-ngang-nen-toi.svg assets/brand/
```

`@font-face` in EVERY composition file (sub-compositions render in isolation - never rely on `var()` or fonts declared in the master):

```css
@font-face { font-family: "Archivo"; src: url("../assets/fonts/Archivo-VF.ttf") format("truetype"); font-weight: 100 900; font-stretch: 62% 125%; }
@font-face { font-family: "Be Vietnam Pro"; src: url("../assets/fonts/BeVietnamPro-SemiBold.ttf"); font-weight: 600; }
@font-face { font-family: "Be Vietnam Pro"; src: url("../assets/fonts/BeVietnamPro-Regular.ttf"); font-weight: 400; }
@font-face { font-family: "JetBrains Mono"; src: url("../assets/fonts/JetBrainsMono-VF.ttf"); font-weight: 100 800; }
```

Adjust the relative path to where the composition lives. Verify on the first snapshot that Archivo actually renders condensed (62%) - if it renders at normal width, the font did not load.

## 3. Visual components (literal hex - no CSS variables in sub-compositions)

| Token | Hex |
|---|---|
| peach (Wow, level 1) | `#ffd3c2` |
| sky (Consent, level 2) | `#cde4ff` |
| mint (Engage, level 3) | `#d1ffca` |
| lilac (neutral rotation) | `#e4d9ff` |
| yellow (only "Đang thử nghiệm") | `#fff100` |
| black / white | `#000000` / `#ffffff` |
| g5 secondary text on light | `#444444` |
| caption pill on footage | `rgba(0,0,0,0.72)` |

### 3.1 Level bar (top-left, whole video)
Three pills in a row, peach · sky · mint, each 72×10px, radius 5px, gap 8px, at `top: 150px; left: 64px`. The level the current beat talks about is at opacity 1, the other two at 0.3. Beats with no level: all three at 1. Change level with a 0.3s opacity tween only. This replaces any corner logo - **never add a corner logo**.

### 3.2 Layer card (the main on-screen text)
- Solid pastel block in the color of its layer, radius 32px, padding 40px 48px, **black text only**.
- Headline: Archivo 800, `font-stretch: 62%`, 120–160px, letter-spacing -0.02em, line-height 0.95, sentence case.
- Max one Archivo headline per frame. Max 3 pastel colors per frame.
- Enter: y 40→0 + opacity 0→1, 0.45s `power3.out`. No scale-pop glow, no drop-shadow, no blur.

### 3.3 Number card
Same as the layer card, with the number large (Archivo 800, 62%, 200–260px), one meaning line in Be Vietnam Pro 600 at 52px, and a mono label at 30px with date and place, e.g. `TikTok Beauty Fest · 1 ngày`. Vietnamese number format: `5.000+`, `1,5 lần`.

### 3.4 Source tag
A JetBrains Mono 30px label in a black pill (`rgba(0,0,0,0.72)`, white text, radius 64px, padding 10px 20px), bottom-left above the caption zone, visible for the whole beat where a BCG term or number appears. Text: `Nguồn: BCG × Google, 2021` or `... 2024`, exactly as in the scene sheet.

### 3.5 Status tag
A feature still in test gets a yellow pill `#fff100`, black JetBrains Mono text "Đang thử nghiệm". Yellow is never used for anything else.

### 3.6 Captions
- Be Vietnam Pro 600, 52-60px, max 2 lines, white text in the black caption pill.
- Active word: underline 6px in the color of the current layer, not a color change, glow or scale.
- Position: `bottom: 420px` (the guideline safe zone keeps all text at least 400px above the bottom edge - do NOT use the 372px from `noti-tiktok-vn`). Keep clear of the top 150px and the right 140px.

### 3.7 End card (last 2.5s)
Black full frame. `assets/brand/activos-ngang-nen-toi.svg` centered, width 640px. Below it "Make offline count." in Archivo 800 at 62%, 96px, white, then `activos.vn` in JetBrains Mono 36px, `#979797`. Fade in 0.4s. Insert the logo as `<img>` from the file - never redraw it.

### 3.8 Forbidden visuals
Gradients, glow, drop-shadow on text, glassmorphism or backdrop blur, grain, emoji, all-caps text (no `text-transform: uppercase`), white text on any pastel or yellow, red or green for right/wrong, stock or AI images, any logo of a client brand unless the brief says it is approved.

## 4. Footage rules
- Source: Trí's Google Shared Drive (`drive.google.com/drive/folders/0AAVIirV656S_Uk9PVA`). The CLI cannot open it (needs his Google login), so he downloads clips to `~/Downloads` (sometimes as a Drive zip) and says so.
- **Never import the same clip twice.** He re-downloads for every edit, and Drive adds ` (1)` suffixes, so compare by `shasum -a 256`, not by filename, against everything already in `imports/` and `video-projects/*/assets/`. Copy only new hashes; list skipped duplicates in the report.
- Only real footage from `assets/`. `autoIllustrations` must be off - if the brief has it on, stop and ask.
- Consumer faces must not be recognizable: prefer wide, from-behind or hand close-ups. If a usable clip shows a face, blur it (`filter: blur(18px)` on a tracked region, or crop) and say so in the report.
- Blur every visible name or phone number on machine screens.
- Zoom technique from `noti-tiktok-vn` applies, but slow and rare: 1 punch-in every 6-10s, scale 1 → 1.08 max (guideline section 5), no snap or shake.

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
[00:55-00:58] end
```

- `lop`: wow → peach, consent → sky, engage → mint, none → lilac or no card.
- `cap`: which pill of the level bar is lit (1/2/3, `-` for all).
- `the_chu`: card headline, verbatim. `nhan`: mono label. `nguon`: source tag text or `-`.
- Times are approximate: snap each beat to the nearest word in the transcript where the idea starts.
- If there is no scene sheet, derive beats from the transcript and the guideline's video formula (section 6 of the guideline), and present the beat table for approval before building.

## 7. Report checklist (in addition to `video-pipeline`)
- [ ] Guideline md was read this session (say so in the report)
- [ ] Fonts loaded from `assets/fonts/` (Archivo condensed visible on a snapshot)
- [ ] No corner logo; end card uses the logo file
- [ ] Content QC table included
- [ ] Any face/name/number blurred is listed with its timestamp
