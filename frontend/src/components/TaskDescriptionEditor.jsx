import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { ImagePaste, imageToBase64 } from '../extensions/ImagePaste';
import { Bold, Italic, List, ListOrdered, Image as ImageIcon } from 'lucide-react';

const TaskDescriptionEditor = ({ value, onChange, placeholder = 'Descripción...' }) => {
  const fileInputRef = useRef(null);

  // Convert any value to TipTap-compatible content
  const parseContent = (val) => {
    if (!val) return '';
    if (typeof val === 'object') return val;
    try {
      const parsed = JSON.parse(val);
      if (parsed && parsed.type === 'doc') return parsed;
    } catch {}
    // Legacy plain text — convert newlines to separate paragraphs
    const lines = val.split('\n');
    return lines.map(line => `<p>${line || '<br>'}</p>`).join('');
  };

  const isInternalChange = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, codeBlock: false, blockquote: false }),
      Placeholder.configure({ placeholder }),
      ImagePaste.configure({ inline: false, allowBase64: true }),
    ],
    content: parseContent(value),
    onUpdate: ({ editor }) => {
      if (onChange) {
        isInternalChange.current = true;
        const json = editor.getJSON();
        onChange(JSON.stringify(json));
      }
    },
  });

  // Sync when value changes externally (e.g. modal opens with task data)
  useEffect(() => {
    if (!editor || !value) return;
    // Skip updates that came from our own onUpdate callback
    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }
    const content = parseContent(value);
    editor.commands.setContent(content);
  }, [editor, value]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const dataUrl = await imageToBase64(file);
      editor.chain().focus().setImage({ src: dataUrl }).run();
    } catch (err) {
      console.error('Error processing image:', err);
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
