// Video URL patterns for supported platforms
const VIDEO_PATTERNS = {
  youtube: [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
    /youtube\.com\/embed\/([\w-]+)/,
    /youtube\.com\/shorts\/([\w-]+)/,
  ],
  vimeo: [
    /vimeo\.com\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/,
  ],
  screenstudio: [
    /screen\.studio\/share\/([\w-]+)/,
  ],
  tiktok: [
    /tiktok\.com\/@[\w.]+\/video\/(\d+)/,
    /vm\.tiktok\.com\/([\w-]+)/,
  ],
  instagram: [
    /instagram\.com\/(?:p|reel)\/([\w-]+)/,
  ],
  twitter: [
    /(?:twitter|x)\.com\/\w+\/status\/(\d+)/,
  ],
};

/**
 * Parse a video URL and return platform and video ID
 * @param {string} url - The video URL to parse
 * @returns {{ platform: string, videoId: string } | null}
 */
export const parseVideoUrl = (url) => {
  if (!url) return null;

  for (const [platform, patterns] of Object.entries(VIDEO_PATTERNS)) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { platform, videoId: match[1] };
      }
    }
  }
  return null;
};

/**
 * Generate embed HTML for a video
 * @param {string} platform - The platform name
 * @param {string} videoId - The video ID
 * @returns {string} - HTML string for the embed
 */
export const generateEmbedHTML = (platform, videoId) => {
  const embeds = {
    youtube: `<iframe
      src="https://www.youtube.com/embed/${videoId}"
      width="560"
      height="315"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowfullscreen
      style="max-width: 100%; border-radius: 8px;"
    ></iframe>`,

    vimeo: `<iframe
      src="https://player.vimeo.com/video/${videoId}"
      width="560"
      height="315"
      frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture"
      allowfullscreen
      style="max-width: 100%; border-radius: 8px;"
    ></iframe>`,

    screenstudio: `<iframe
      src="https://screen.studio/share/${videoId}"
      width="560"
      height="315"
      frameborder="0"
      allow="autoplay; fullscreen"
      allowfullscreen
      style="max-width: 100%; border-radius: 8px;"
    ></iframe>`,

    tiktok: `<blockquote
      class="tiktok-embed"
      cite="https://www.tiktok.com/video/${videoId}"
      data-video-id="${videoId}"
      style="max-width: 605px; min-width: 325px;"
    >
      <section></section>
    </blockquote>`,

    instagram: `<blockquote
      class="instagram-media"
      data-instgrm-permalink="https://www.instagram.com/p/${videoId}/"
      data-instgrm-version="14"
      style="max-width: 540px; min-width: 326px; width: 100%;"
    ></blockquote>`,

    twitter: `<blockquote class="twitter-tweet">
      <a href="https://twitter.com/x/status/${videoId}"></a>
    </blockquote>`,
  };

  return embeds[platform] || '';
};

/**
 * Get platform display name
 * @param {string} platform - The platform key
 * @returns {string} - Human readable platform name
 */
export const getPlatformName = (platform) => {
  const names = {
    youtube: 'YouTube',
    vimeo: 'Vimeo',
    screenstudio: 'Screen Studio',
    tiktok: 'TikTok',
    instagram: 'Instagram',
    twitter: 'Twitter/X',
  };
  return names[platform] || platform;
};

/**
 * Get platform icon/emoji
 * @param {string} platform - The platform key
 * @returns {string} - Emoji for the platform
 */
export const getPlatformIcon = (platform) => {
  const icons = {
    youtube: '▶️',
    vimeo: '🎬',
    screenstudio: '🖥️',
    tiktok: '🎵',
    instagram: '📷',
    twitter: '🐦',
  };
  return icons[platform] || '🎥';
};

export default {
  parseVideoUrl,
  generateEmbedHTML,
  getPlatformName,
  getPlatformIcon,
};
