import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ImagePaste } from '../extensions/ImagePaste';
import { Bold, Italic, List, ListOrdered, Image as ImageIcon } from 'lucide-react';
import { notesAPI } from '../utils/api';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const TaskDescriptionEditor = ({ value, onChange, placeholder = 'Descripción...' }) => {
  const fileInputRef = useRef(null);

  // Parse initial content: could be JSON (TipTap) or plain string (legacy)
  const initialContent = (() => {
    if (!value) return '';
    if (typeof value === 'object') return value;
    try {
      const parsed = JSON.parse(value);
      if (parsed && parsed.type === 'doc') return parsed;
    } catch {}
    // Legacy plain text — convert newlines to separate paragraphs
    // so TipTap preserves the original line breaks
    const lines = value.split('\n');
    return lines.map(line => `<p>${line || '<br>'}</p>`).join('');
  })();

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Placeholder.configure({ placeholder }),
      ImagePaste.configure({ inline: false, allowBase64: true }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (onChange) {
        const json = editor.getJSON();
        const text = editor.getText();
        // Store as JSON string so backend gets rich content
        onChange(JSON.stringify(json), text);
      }
    },
  });

  // Sync external value changes
  useEffect(() => {
    if (!editor || !value) return;
    const currentJson = JSON.stringify(editor.getJSON());
    // Only update if value is different (avoid cursor jumps)
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed?.type === 'doc' && JSON.stringify(parsed) !== currentJson) {
          editor.commands.setContent(parsed);
        }
      } catch {
        // plain text — don't override if editor already has content
      }
    }
  }, [value]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const canvas = document.createElement('canvas');
      const img = new window.Image();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });
      const maxWidth = 1200;
      const ratio = Math.min(maxWidth / img.width, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
      const formData = new FormData();
      formData.append('image', blob, 'image.jpg');
      const res = await notesAPI.uploadImage(formData);
      editor.chain().focus().setImage({ src: `${API_BASE}${res.data.url}` }).run();
    } catch (err) {
      console.error('Error uploading image:', err);
    }
    e.target.value = '';
  };

  if (!editor) return null;

  return (
    <div className="task-desc-editor border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Compact toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50/50">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}
          title="Negrita"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}
          title="Cursiva"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}
          title="Lista"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-200 text-gray-900' : 'text-gray-500'}`}
          title="Lista numerada"
        >
          <ListOrdered size={15} />
        </button>
        <div className="w-px h-4 bg-gray-200 mx-0.5" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-1 rounded hover:bg-gray-200 transition-colors text-gray-500"
          title="Insertar imagen (o pega del portapapeles)"
        >
          <ImageIcon size={15} />
        </button>
      </div>

      <EditorContent editor={editor} className="prose prose-sm max-w-none" />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        className="hidden"
      />

      <style>{`
        .task-desc-editor .ProseMirror {
          padding: 0.5rem 0.75rem;
          min-height: 80px;
          max-height: 300px;
          overflow-y: auto;
          outline: none;
          font-size: 0.875rem;
        }
        .task-desc-editor .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #94a3b8;
          pointer-events: none;
          height: 0;
        }
        .task-desc-editor .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.375rem;
          margin: 0.5rem 0;
        }
        .task-desc-editor .ProseMirror img.ProseMirror-selectednode {
          outline: 2px solid #3b82f6;
          outline-offset: 2px;
        }
        .task-desc-editor .ProseMirror ul, .task-desc-editor .ProseMirror ol {
          padding-left: 1.25rem;
        }
        .task-desc-editor .ProseMirror li {
          margin: 0.125rem 0;
        }
      `}</style>
    </div>
  );
};

export default TaskDescriptionEditor;
