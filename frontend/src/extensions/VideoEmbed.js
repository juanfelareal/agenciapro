import { Node, mergeAttributes } from '@tiptap/core';
import { parseVideoUrl, generateEmbedHTML, getPlatformName, getPlatformIcon } from '../utils/videoEmbedParser';

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      platform: {
        default: null,
      },
      videoId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-video-embed': '' })];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.className = 'video-embed-wrapper';
      dom.setAttribute('data-video-embed', '');
      dom.setAttribute('data-platform', node.attrs.platform || '');

      const { platform, videoId } = node.attrs;

      if (platform && videoId) {
        // Create wrapper with platform badge
        const badge = document.createElement('div');
        badge.className = 'video-embed-badge';
        badge.innerHTML = `${getPlatformIcon(platform)} ${getPlatformName(platform)}`;
        dom.appendChild(badge);

        // Create embed container
        const embedContainer = document.createElement('div');
        embedContainer.className = 'video-embed-container';
        embedContainer.innerHTML = generateEmbedHTML(platform, videoId);
        dom.appendChild(embedContainer);

        // Screen Studio: add fallback link below video
        if (platform === 'screenstudio') {
          const link = document.createElement('a');
          link.href = `https://screen.studio/share/${videoId}`;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'Ver video en otra pestaña \u2197';
          link.style.cssText = 'display:block;text-align:right;margin-top:4px;font-size:11px;color:#94a3b8;text-decoration:none;';
          link.onmouseenter = () => { link.style.color = '#64748b'; };
          link.onmouseleave = () => { link.style.color = '#94a3b8'; };
          dom.appendChild(link);
        }

        // Load platform scripts if needed
        if (platform === 'tiktok') {
          loadScript('https://www.tiktok.com/embed.js');
        } else if (platform === 'instagram') {
          loadScript('https://www.instagram.com/embed.js', () => {
            if (window.instgrm) {
              window.instgrm.Embeds.process();
            }
          });
        } else if (platform === 'twitter') {
          loadScript('https://platform.twitter.com/widgets.js', () => {
            if (window.twttr) {
              window.twttr.widgets.load(dom);
            }
          });
        }
      } else {
        dom.innerHTML = '<div class="video-embed-error">Video no disponible</div>';
      }

      return {
        dom,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'videoEmbed') return false;
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      setVideoEmbed:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          });
        },
    };
  },
});

// Helper to load external scripts
const loadedScripts = new Set();

function loadScript(src, callback) {
  if (loadedScripts.has(src)) {
    if (callback) callback();
    return;
  }

  const existingScript = document.querySelector(`script[src="${src}"]`);
  if (existingScript) {
    loadedScripts.add(src);
    if (callback) callback();
    return;
  }

  const script = document.createElement('script');
  script.src = src;
  script.async = true;
  script.onload = () => {
    loadedScripts.add(src);
    if (callback) callback();
  };
  document.body.appendChild(script);
}

export default VideoEmbed;
