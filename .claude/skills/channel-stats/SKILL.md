---
name: channel-stats
description: Update the "Chỉ số kênh" dashboard with post-publish numbers (views, watch time, retention at 2/5/10s, followers) read from TikTok Studio, Facebook and YouTube Studio through Claude in Chrome. Use when the user says "cập nhật chỉ số kênh", "đo video", or asks how a posted short performed.
---

# Channel stats - measure posted shorts and record them

The web page `/channel-stats` only displays data. You read the numbers from each platform's analytics pages and write them through the backend API. Data lives in the gitignored `channel-stats/` folder (the repo is public, this is private channel data).

## Hard rules

1. **Read-only on the platforms.** Never post, edit, delete, reply, pin, or change any setting on TikTok, Facebook or YouTube.
2. **Never record commenter names**, profile links, or any viewer personal data. Counts only. `notes` is for measurement context (time, source of a number), not for comment text.
3. **Measure at the milestones: 24h, 7d, 30d after posting** (`milestone`: `"24h" | "7d" | "30d"`). Upsert key is `(videoId, platform, milestone)`, so re-measuring the same milestone overwrites.
4. **Write the measuring time in `notes`** ("Đo 21:45; đăng 17:52"). If you measure before the milestone is reached (e.g. 4h into the 24h window), say so in `notes` ("mới ~4h, chưa đủ 24h").
5. **Leave unknown fields out (null)**. Never estimate or copy a number from another platform. If a figure was derived (e.g. avg watch = 15.3% x 114s), say how in `notes`.

## 1. Find what to measure

```bash
curl -s http://localhost:6869/api/channel-stats | head -c 4000   # or the web rewrite on :6868
```

Posted videos (`status: "posted"`) with a missing or stale measurement for the milestone they have reached are the targets. A video not in the catalog yet: add it first.

```bash
curl -s -X PUT http://localhost:6869/api/channel-stats/videos/<video-id> \
  -H 'Content-Type: application/json' \
  -d '{"title":"...","durationSec":89,"pillar":2,"axis":"...","audience":"P1","status":"posted","postedAt":"2026-11-12","postedHour":17,"opensWith":"canh-that"}'
```

`id` is kebab-case. `pillar`: 1 Data & insight, 2 Ý tưởng/công nghệ/sự kiện hot, 3 Đúng luật. `opensWith`: `canh-that` | `mat` | `the-chu`.

## 2. TikTok Studio (Claude in Chrome)

Open `https://www.tiktok.com/tiktokstudio/analytics/<videoId>` (the numeric TikTok video id, not the catalog id).

- `get_page_text` returns: views, total play time, **average watch time**, **watched full** %, new followers, likes/comments/shares/saves, traffic sources (For You feed %, search %).
  - Map: `views`, `avgWatchSec`, `fullWatch` (fraction), `newFollowers`, `pctFeed`, `pctSearch` (fractions, 0.969 = 96.9%).
- **Retention chart is a canvas** - the text is not in the DOM. Read it by hovering:
  1. Scroll the retention chart into view and take a screenshot to locate the plot area (x-axis starts at 0s, ends at the video duration, linear).
  2. For each of 2s, 5s, 10s compute `x = left + (t / durationSec) * (right - left)` and hover (mouse move) at that x inside the plot.
  3. Zoom-screenshot the tooltip. It reads like `0:02 / 47%`. Record 47% as `0.47`. Check the tooltip time matches the target second; if it shows 0:01 or 0:03, nudge x and re-read.
  4. Fill `retention: { "s2": 0.47, "s5": ..., "s10": ... }`. A video shorter than 10s has no `s10` (omit it).
- The **views-by-hour chart** shows the distribution window (when views arrived). Put a one-line summary in `notes` ("đỉnh 18-20h"); also fill `postedHour` on the catalog entry if missing.

If the Studio layout changed and a number cannot be found, leave the field null and say so in `notes`. Do not guess.

## 3. Facebook Reels and YouTube Studio

Read what the page exposes (views, likes, comments, shares, saves, avg watch, % retained) and leave the rest null.

- FB: since 16/11/2026 Trí no longer posts these shorts on his Facebook (wow visual posts only, direction to be decided). Keep reading the FB Reels already posted at their milestones; do not flag missing FB posts for new videos.
- FB Reels: Meta Business Suite / the Reel's insights on the profile page. Views, reactions, comments, shares, avg watch time (often shown as % of video - convert with `durationSec` and say so in `notes`).
- YouTube Studio: Content -> Shorts -> Analytics. "Viewed vs swiped away" is not the same as watch time - record it in `notes`, not in `avgWatchSec`. New videos often show "not enough data yet" for watch time; leave null.
- Platform codes: `tiktok`, `fb`, `yt`.

## 3b. Profile views (account level)

Trí treats profile views as the closest signal to a buyer: someone who opens the profile wants to know who Trí is, one step before looking up TryOh (his call, 15/11/2026). Platforms only give it per account per day, never per video, but it follows behaviour closely, so attribute it by day.

- TikTok Studio -> Analytics -> Overview: "Profile views" by day (7/28/60 days). Facebook professional dashboard: profile visits by day. YouTube has no equivalent (use subscribers gained per video).
- Read the daily series from the day before the first post, and line it up with each video's post date and hour. A jump on the day a video went out (and the next morning) belongs to that video; when two videos share a day, say so instead of splitting the number.
- Until the dashboard has a field for it, write the per-video attribution in that video's 24h/7d measurement `notes` ("profile views 15/11: 23, ngày thường ~5"). Keep the raw daily series in `channel-stats/profile-views.json` (`[{"date","platform","profileViews"}]`, gitignored with the rest).

## 4. Write the numbers

```bash
curl -s -X PUT http://localhost:6869/api/channel-stats/measurements \
  -H 'Content-Type: application/json' \
  -d '[{
    "videoId":"tommy-coach-thu-do-ao","platform":"tiktok","milestone":"24h",
    "measuredAt":"2026-11-13T21:45:00+07:00",
    "views":619,"avgWatchSec":11.17,"fullWatch":0.035,
    "likes":9,"comments":0,"shares":0,"saves":0,"newFollowers":1,
    "pctFeed":0.969,"pctSearch":0.002,
    "retention":{"s2":0.47,"s5":0.31,"s10":0.2},
    "notes":"Đo 21:45; mốc 24h đủ"
  }]'
```

Validation (400 `INVALID_CHANNEL_STATS`): numbers >= 0, fractions 0..1 (`fullWatch`, `pctFeed`, `pctSearch`, `retention.*`), `platform` and `milestone` from the enums above, `measuredAt` as `yyyy-mm-dd` or ISO datetime. Send all measurements of one session in one array.

Then tell the user in one or two lines what changed (e.g. "TikTok 24h: 619 views, giữ 47% ở giây 2 - chưa đạt mục tiêu 65%") and that the page `/channel-stats` is updated.

## 5. Lessons

The dashboard card "Bài học đang kiểm chứng" comes from `PUT /api/channel-stats/lessons` (replaces the whole list). Each lesson: `{ "id", "text", "status": "testing" | "confirmed" | "dropped" }`. Fetch the current list first, change only what the user confirmed, send the full list back.

Update lessons only when the user confirms or drops one - not from a single measurement. Keep this in sync with the lessons section of the `activos-tiktok` skill (its lessons-being-tested list, 6.2 where present): that skill holds the content rules, this page holds the evidence.

## Goals used by the dashboard

Average watch >= 8s, still watching at 2s >= 65%, pillar mix target 35% / 45% / 20%, posted-video milestones 10 / 30 / 50. Change them in `apps/web/src/app/channel-stats/page.tsx` if the strategy changes.
