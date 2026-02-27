import { Router } from 'express';
import axios from 'axios';

const router = Router();

// In-memory cache: videoId -> { url, expiresAt }
const urlCache = new Map();
const CACHE_TTL = 90 * 60 * 1000; // 90 min (signed URLs expire in 2h)

async function resolveVideoUrl(videoId) {
  const cached = urlCache.get(videoId);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.url;
  }

  const { data: html } = await axios.get(`https://screen.studio/share/${videoId}`, {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });

  const match = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/);
  if (!match) return null;

  const url = match[1].replace(/&amp;/g, '&');
  urlCache.set(videoId, { url, expiresAt: Date.now() + CACHE_TTL });
  return url;
}

// GET /api/screenstudio/:videoId/video
// Proxies the video stream from Screen Studio's R2 storage
router.get('/:videoId/video', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!/^[\w-]+$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const videoUrl = await resolveVideoUrl(videoId);
    if (!videoUrl) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Support Range requests for seeking
    const headers = {};
    if (req.headers.range) {
      headers.Range = req.headers.range;
    }

    const videoRes = await axios.get(videoUrl, {
      responseType: 'stream',
      headers,
      timeout: 30000,
    });

    res.status(videoRes.status);
    res.set('Content-Type', videoRes.headers['content-type'] || 'video/mp4');
    if (videoRes.headers['content-length']) {
      res.set('Content-Length', videoRes.headers['content-length']);
    }
    if (videoRes.headers['content-range']) {
      res.set('Content-Range', videoRes.headers['content-range']);
    }
    res.set('Accept-Ranges', 'bytes');
    res.set('Cache-Control', 'public, max-age=3600');

    videoRes.data.pipe(res);
  } catch (err) {
    console.error('Screen Studio proxy error:', err.message);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Could not fetch video' });
    }
  }
});

export default router;
