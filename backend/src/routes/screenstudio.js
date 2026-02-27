import { Router } from 'express';
import axios from 'axios';

const router = Router();

// GET /api/screenstudio/:videoId/video
// Fetches the Screen Studio share page, extracts the og:video MP4 URL, and redirects
router.get('/:videoId/video', async (req, res) => {
  try {
    const { videoId } = req.params;

    if (!/^[\w-]+$/.test(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const { data: html } = await axios.get(`https://screen.studio/share/${videoId}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const match = html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/);
    if (!match) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.redirect(match[1]);
  } catch (err) {
    console.error('Screen Studio proxy error:', err.message);
    res.status(502).json({ error: 'Could not fetch video' });
  }
});

export default router;
