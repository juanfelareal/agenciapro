import Image from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';
import { notesAPI } from '../utils/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

// Upload image file to server, returns full URL
const uploadImage = async (file) => {
  // Compress on canvas first
  const compressed = await compressImage(file);
  const formData = new FormData();
  formData.append('image', compressed, 'image.jpg');
  const res = await notesAPI.uploadImage(formData);
  // res.data.url is like "/uploads/notes/xxx.jpg" — prepend backend base
  return `${API_BASE}${res.data.url}`;
};

// Compress image to a smaller Blob
const compressImage = (file, maxWidth = 1200, quality = 0.8) => {
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
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('Compression failed')),
          'image/jpeg',
          quality
        );
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
                  uploadImage(file).then((url) => {
                    editor.chain().focus().setImage({ src: url }).run();
                  }).catch((err) => {
                    console.error('Error uploading image:', err);
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
                uploadImage(file).then((url) => {
                  editor.chain().focus().setImage({ src: url }).run();
                }).catch((err) => {
                  console.error('Error uploading image:', err);
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
