// Detecta el tipo de URL pegada por la agencia y devuelve cómo renderizarla
// en el portal del cliente (iframe / imagen / video / tarjeta de link).
export function getEmbed(rawUrl) {
  if (!rawUrl) return null;
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return { kind: 'link', src: rawUrl, label: 'Link' };
  }
  const host = u.hostname.replace(/^www\./, '');

  // Google Drive
  if (host === 'drive.google.com') {
    const fileMatch = u.pathname.match(/\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return { kind: 'iframe', src: `https://drive.google.com/file/d/${fileMatch[1]}/preview`, label: 'Google Drive' };
    }
    const folderMatch = u.pathname.match(/\/drive\/folders\/([^/?]+)/);
    if (folderMatch) {
      return { kind: 'iframe', src: `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#list`, label: 'Google Drive · Carpeta' };
    }
    const openId = u.searchParams.get('id');
    if (openId) {
      return { kind: 'iframe', src: `https://drive.google.com/file/d/${openId}/preview`, label: 'Google Drive' };
    }
  }

  // Google Docs / Sheets / Slides
  if (host === 'docs.google.com') {
    const m = u.pathname.match(/\/(document|spreadsheets|presentation)\/d\/([^/]+)/);
    if (m) {
      const labels = { document: 'Google Docs', spreadsheets: 'Google Sheets', presentation: 'Google Slides' };
      return { kind: 'iframe', src: `https://docs.google.com/${m[1]}/d/${m[2]}/preview`, label: labels[m[1]] };
    }
  }

  // YouTube
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const v = u.searchParams.get('v');
    if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${v}`, label: 'YouTube' };
  }
  if (host === 'youtu.be') {
    const id = u.pathname.replace(/^\//, '');
    if (id) return { kind: 'iframe', src: `https://www.youtube.com/embed/${id}`, label: 'YouTube' };
  }

  // Loom
  if (host === 'loom.com') {
    const m = u.pathname.match(/\/share\/([^/?]+)/);
    if (m) return { kind: 'iframe', src: `https://www.loom.com/embed/${m[1]}`, label: 'Loom' };
  }

  // Figma (file / design / proto)
  if (host === 'figma.com') {
    return { kind: 'iframe', src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(rawUrl)}`, label: 'Figma' };
  }

  // Vimeo
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(\d+)/);
    if (m) return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}`, label: 'Vimeo' };
  }

  // Canva (presentaciones públicas)
  if (host === 'canva.com') {
    const m = u.pathname.match(/\/design\/([^/]+)\/([^/?]+)/);
    if (m) {
      return { kind: 'iframe', src: `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`, label: 'Canva' };
    }
  }

  // Imagen directa
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?|#|$)/i.test(u.pathname)) {
    return { kind: 'image', src: rawUrl, label: 'Imagen' };
  }

  // Video directo
  if (/\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u.pathname)) {
    return { kind: 'video', src: rawUrl, label: 'Video' };
  }

  // PDF directo
  if (/\.pdf(\?|#|$)/i.test(u.pathname)) {
    return { kind: 'iframe', src: rawUrl, label: 'PDF' };
  }

  // Default — tarjeta clickable
  return { kind: 'link', src: rawUrl, label: host };
}
