import { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
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
  Quote
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

const EditorToolbar = ({ editor }) => {
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

  return (
    <div className={`border border-slate-200 rounded-lg bg-white overflow-hidden ${readOnly ? 'border-transparent' : ''}`}>
      {!readOnly && <EditorToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none"
        style={{ minHeight }}
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
  );
};

export default NoteEditor;
