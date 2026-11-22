import { Router } from "express";
import { readChannelStats, replaceLessons, upsertMeasurements, upsertVideo } from "../channelStats.js";

/**
 * Chỉ số kênh - trang /channel-stats. Nguồn sự thật: channel-stats/*.json (xem
 * channelStats.ts). Contract ở docs/API.md mục "Channel stats". Cố ý KHÔNG đặt
 * dưới /api/metrics: đường dẫn đó là mức dùng CPU/GPU.
 */
const router = Router();

router.get("/", (_req, res) => {
  res.json(readChannelStats());
});

// Body: Measurement[] - upsert theo (videoId, platform, milestone)
router.put("/measurements", (req, res) => {
  const all = upsertMeasurements(req.body);
  res.json({ count: all.length });
});

router.put("/videos/:id", (req, res) => {
  res.json(upsertVideo(String(req.params.id), req.body));
});

// Body: Lesson[] - thay toàn bộ danh sách
router.put("/lessons", (req, res) => {
  res.json(replaceLessons(req.body));
});

export default router;
