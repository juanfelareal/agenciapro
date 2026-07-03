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
