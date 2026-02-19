import Image from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';

// Compress image to base64
const compressImageToBase64 = (file, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Check size (warn if > 500KB)
        const base64Length = dataUrl.length - 'data:image/jpeg;base64,'.length;
        const sizeInKB = (base64Length * 0.75) / 1024;
        if (sizeInKB > 500) {
          console.warn(`Image is ${sizeInKB.toFixed(0)}KB after compression`);
        }

        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const ImagePaste = Image.extend({
  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const items = event.clipboardData?.items;
            if (!items) return false;

            for (const item of items) {
              if (item.type.startsWith('image/')) {
                event.preventDefault();
                const file = item.getAsFile();
                if (file) {
                  compressImageToBase64(file).then((base64) => {
                    editor.chain().focus().setImage({ src: base64 }).run();
                  }).catch((err) => {
                    console.error('Error compressing image:', err);
                  });
                }
                return true;
              }
            }
            return false;
          },
          handleDrop(view, event) {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            for (const file of files) {
              if (file.type.startsWith('image/')) {
                event.preventDefault();
                compressImageToBase64(file).then((base64) => {
                  const { state } = view;
                  const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
                  if (pos) {
                    editor.chain().focus().setImage({ src: base64 }).run();
                  }
                }).catch((err) => {
                  console.error('Error compressing image:', err);
                });
                return true;
              }
            }
            return false;
          },
        },
      }),
    ];
  },
});

export default ImagePaste;
