import { useEffect, useMemo, useState, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import { ImagePaste } from '../extensions/ImagePaste';
import { VideoEmbed } from '../extensions/VideoEmbed';
import VideoEmbedModal from './VideoEmbedModal';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  CheckSquare,
  Highlighter,
  Code,
  Undo,
  Redo,
  Quote,
  Image,
  Video
} from 'lucide-react';

const MenuButton = ({ onClick, isActive, disabled, children, title }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
      isActive ? 'bg-slate-200 text-primary-600' : 'text-slate-600'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
  >
    {children}
  </button>
);

const EditorToolbar = ({ editor, onImageClick, onVideoClick }) => {
  if (!editor) return null;

  return (
    <div className="flex items-center gap-0.5 p-2 border-b border-slate-200 flex-wrap">
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        isActive={editor.isActive('heading', { level: 1 })}
        title="Encabezado 1"
      >
        <Heading1 size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        isActive={editor.isActive('heading', { level: 2 })}
        title="Encabezado 2"
      >
        <Heading2 size={18} />
      </MenuButton>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Negrita (Ctrl+B)"
      >
        <Bold size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Cursiva (Ctrl+I)"
      >
        <Italic size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        isActive={editor.isActive('highlight')}
        title="Resaltar"
      >
        <Highlighter size={18} />
      </MenuButton>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Lista con viñetas"
      >
        <List size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        <ListOrdered size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Lista de tareas"
      >
        <CheckSquare size={18} />
      </MenuButton>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Cita"
      >
        <Quote size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        isActive={editor.isActive('codeBlock')}
        title="Bloque de código"
      >
        <Code size={18} />
      </MenuButton>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      {/* Image button */}
      <MenuButton
        onClick={onImageClick}
        title="Insertar imagen (o pega desde portapapeles)"
      >
        <Image size={18} />
      </MenuButton>

      {/* Video button */}
      <MenuButton
        onClick={onVideoClick}
        title="Insertar video"
      >
        <Video size={18} />
      </MenuButton>

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <MenuButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Deshacer (Ctrl+Z)"
      >
        <Undo size={18} />
      </MenuButton>
      <MenuButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Rehacer (Ctrl+Y)"
      >
        <Redo size={18} />
      </MenuButton>
    </div>
  );
};

const NoteEditor = ({
  content,
  onChange,
  placeholder = 'Escribe tu nota aquí...',
  readOnly = false,
  minHeight = '200px',
  // Collaboration props
  collaborative = false,
  ydoc = null,
  awareness = null,
  user = null,
}) => {
  const [showVideoModal, setShowVideoModal] = useState(false);
  const fileInputRef = useRef(null);

  // Build extensions based on collaborative mode
  const extensions = useMemo(() => {
    const baseExtensions = [
      Placeholder.configure({
        placeholder,
      }),
      Highlight.configure({
        multicolor: false,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      ImagePaste.configure({
        inline: false,
        allowBase64: true,
      }),
      VideoEmbed,
    ];

    if (collaborative && ydoc) {
      // Collaborative mode - use Yjs
      baseExtensions.push(
        StarterKit.configure({
          heading: { levels: [1, 2] },
          // Disable history in collaborative mode - Yjs handles it
          history: false,
        }),
        Collaboration.configure({
          document: ydoc,
        })
      );

      if (awareness) {
        baseExtensions.push(
          CollaborationCursor.configure({
            provider: { awareness },
            user: user || { name: 'Anonymous', color: '#60A5FA' },
          })
        );
      }
    } else {
      // Non-collaborative mode
      baseExtensions.push(
        StarterKit.configure({
          heading: { levels: [1, 2] },
        })
      );
    }

    return baseExtensions;
  }, [collaborative, ydoc, awareness, user, placeholder]);

  const editor = useEditor({
    extensions,
    content: collaborative ? undefined : (content || ''),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      if (onChange && !collaborative) {
        const json = editor.getJSON();
        const text = editor.getText();
        onChange({ json, text });
      } else if (onChange && collaborative) {
        // In collaborative mode, just send plain text for search indexing
        const text = editor.getText();
        onChange({ text });
      }
    },
  }, [collaborative, ydoc]);

  // Update editable state when readOnly prop changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // Update content when it changes externally (non-collaborative mode only)
  useEffect(() => {
    if (editor && content && !collaborative) {
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content);
      if (currentContent !== newContent) {
        editor.commands.setContent(content);
      }
    }
  }, [editor, content, collaborative]);

  // Handle image file selection
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    // Compress and insert
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 800;
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        editor.chain().focus().setImage({ src: dataUrl }).run();
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = '';
  };

  // Handle video insert
  const handleVideoInsert = (videoData) => {
    if (editor) {
      editor.chain().focus().setVideoEmbed(videoData).run();
    }
  };

  return (
    <>
      <div className={`border border-slate-200 rounded-lg bg-white overflow-hidden ${readOnly ? 'border-transparent' : ''}`}>
        {!readOnly && (
          <EditorToolbar
            editor={editor}
            onImageClick={() => fileInputRef.current?.click()}
            onVideoClick={() => setShowVideoModal(true)}
          />
        )}
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none"
          style={{ minHeight }}
        />
        {/* Hidden file input for image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageSelect}
          className="hidden"
        />
        <style>{`
          .ProseMirror {
            padding: 1rem;
            min-height: ${minHeight};
            outline: none;
          }
          .ProseMirror p.is-editor-empty:first-child::before {
            content: attr(data-placeholder);
            float: left;
            color: #94a3b8;
            pointer-events: none;
            height: 0;
          }
          .ProseMirror h1 {
            font-size: 1.5rem;
            font-weight: 700;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror h2 {
            font-size: 1.25rem;
            font-weight: 600;
            margin-top: 0.75rem;
            margin-bottom: 0.5rem;
          }
          .ProseMirror ul[data-type="taskList"] {
            list-style: none;
            padding-left: 0;
          }
          .ProseMirror ul[data-type="taskList"] li {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
          }
          .ProseMirror ul[data-type="taskList"] li > label {
            flex-shrink: 0;
            margin-top: 0.25rem;
          }
          .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
            width: 1rem;
            height: 1rem;
            cursor: pointer;
          }
          .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p {
            text-decoration: line-through;
            color: #94a3b8;
          }
          .ProseMirror blockquote {
            border-left: 3px solid #e2e8f0;
            padding-left: 1rem;
            margin-left: 0;
            color: #64748b;
          }
          .ProseMirror code {
            background: #f1f5f9;
            padding: 0.2em 0.4em;
            border-radius: 0.25rem;
            font-size: 0.9em;
          }
          .ProseMirror pre {
            background: #1e293b;
            color: #e2e8f0;
            padding: 1rem;
            border-radius: 0.5rem;
            overflow-x: auto;
          }
          .ProseMirror pre code {
            background: none;
            padding: 0;
            color: inherit;
          }
          .ProseMirror mark {
            background: #fef08a;
            padding: 0.1em 0.2em;
            border-radius: 0.15rem;
          }
          .ProseMirror ul, .ProseMirror ol {
            padding-left: 1.5rem;
          }
          .ProseMirror li {
            margin: 0.25rem 0;
          }
          /* Image styles */
          .ProseMirror img {
            max-width: 100%;
            height: auto;
            border-radius: 0.5rem;
            margin: 1rem 0;
            cursor: pointer;
          }
          .ProseMirror img.ProseMirror-selectednode {
            outline: 3px solid #3b82f6;
            outline-offset: 2px;
          }
          /* Video embed styles */
          .ProseMirror .video-embed-wrapper {
            margin: 1rem 0;
            padding: 1rem;
            background: #f8fafc;
            border-radius: 0.75rem;
            border: 1px solid #e2e8f0;
          }
          .ProseMirror .video-embed-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            padding: 0.25rem 0.75rem;
            background: white;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 500;
            color: #64748b;
            margin-bottom: 0.75rem;
            border: 1px solid #e2e8f0;
          }
          .ProseMirror .video-embed-container {
            position: relative;
            padding-bottom: 56.25%; /* 16:9 aspect ratio */
            height: 0;
            overflow: hidden;
            border-radius: 0.5rem;
          }
          .ProseMirror .video-embed-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            border: none;
          }
          .ProseMirror .video-embed-container blockquote {
            border: none;
            padding: 0;
            margin: 0;
          }
          .ProseMirror .video-embed-error {
            padding: 2rem;
            text-align: center;
            color: #94a3b8;
            font-size: 0.875rem;
          }
          /* Collaboration cursor styles */
          .collaboration-cursor__caret {
            border-left: 1px solid currentColor;
            border-right: 1px solid currentColor;
            margin-left: -1px;
            margin-right: -1px;
            pointer-events: none;
            position: relative;
            word-break: normal;
          }
          .collaboration-cursor__label {
            font-size: 12px;
            font-style: normal;
            font-weight: 600;
            left: -1px;
            line-height: normal;
            padding: 2px 6px;
            position: absolute;
            top: -1.4em;
            user-select: none;
            white-space: nowrap;
            border-radius: 4px;
            color: white;
          }
        `}</style>
      </div>

      {/* Video Embed Modal */}
      <VideoEmbedModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        onInsert={handleVideoInsert}
      />
    </>
  );
};

export default NoteEditor;
