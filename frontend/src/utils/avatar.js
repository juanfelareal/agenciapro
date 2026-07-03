/**
 * Comprime una imagen a un avatar cuadrado pequeño y devuelve un data-URL JPEG.
 * Se guarda directo en users.avatar_url (TEXT) — sin filesystem, sobrevive deploys.
 *
 * @param {File} file - Imagen seleccionada por el usuario
 * @param {number} size - Lado del cuadrado final en px (default 192)
 * @returns {Promise<string>} data:image/jpeg;base64,...  (~10-25KB)
 */
export function compressImageToDataURL(file, size = 192) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      // Recorte cuadrado centrado (cover)
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      if (dataUrl.length > 300000) {
        reject(new Error('La imagen comprimida sigue siendo muy grande'));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = url;
  });
}

/**
 * Comprime un LOGO manteniendo proporción y transparencia (PNG).
 * Máx `maxSide` px en su lado mayor. Pensado para el portal del cliente.
 */
export function compressLogoToDataURL(file, maxSide = 320) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('El archivo debe ser una imagen'));
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      // PNG conserva transparencia (los logos suelen necesitarla)
      const dataUrl = canvas.toDataURL('image/png');
      if (dataUrl.length > 400000) {
        // Fallback: JPEG sobre blanco si el PNG queda muy pesado
        const c2 = document.createElement('canvas');
        c2.width = w; c2.height = h;
        const ctx2 = c2.getContext('2d');
        ctx2.fillStyle = '#FFFFFF';
        ctx2.fillRect(0, 0, w, h);
        ctx2.drawImage(img, 0, 0, w, h);
        const jpeg = c2.toDataURL('image/jpeg', 0.85);
        if (jpeg.length > 400000) { reject(new Error('El logo sigue muy pesado tras comprimir')); return; }
        resolve(jpeg);
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}
