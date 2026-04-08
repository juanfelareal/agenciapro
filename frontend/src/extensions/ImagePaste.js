import Image from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';

// Convert image file to compressed base64 data URL (no server upload needed)
const imageToBase64 = (file, maxWidth = 1200, quality = 0.7) => {
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export { imageToBase64 };

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
                  imageToBase64(file).then((dataUrl) => {
                    editor.chain().focus().setImage({ src: dataUrl }).run();
                  }).catch((err) => {
                    console.error('Error processing image:', err);
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
                imageToBase64(file).then((dataUrl) => {
                  editor.chain().focus().setImage({ src: dataUrl }).run();
                }).catch((err) => {
                  console.error('Error processing image:', err);
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
