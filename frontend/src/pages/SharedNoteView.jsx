import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { ImagePaste } from '../extensions/ImagePaste';
import { VideoEmbed } from '../extensions/VideoEmbed';
import { ClientEditMark } from '../extensions/ClientEditMark';
import NoteCommentsSidebar from '../components/NoteCommentsSidebar';
import {
  FileText,
  MessageSquare,
  Edit3,
  Save,
  AlertCircle,
  Loader2,
  ChevronLeft,
  X
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/api$/, '') || 'http://localhost:3000';

const SharedNoteView = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteData, setNoteData] = useState(null);
  const [comments, setComments] = useState([]);
  const [authorName, setAuthorName] = useState(localStorage.getItem('shared_note_author') || '');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedText, setSelectedText] = useState(null);
  const [showComments, setShowComments] = useState(true);
  const [originalContent, setOriginalContent] = useState(null);

  // Build extensions
  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [1, 2] },
    }),
    Placeholder.configure({
      placeholder: 'Contenido de la nota...',
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
    ClientEditMark,
  ], []);

  const editor = useEditor({
    extensions,
    content: '',
    editable: false,
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      if (from !== to) {
        const text = editor.state.doc.textBetween(from, to, ' ');
        setSelectedText({ from, to, text });
      } else {
        setSelectedText(null);
      }
    },
  });

  // Fetch note data
  useEffect(() => {
    const fetchNote = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/note-share/public/${token}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Error cargando la nota');
        }

        const data = await response.json();
        setNoteData(data);
        setComments(data.comments || []);

        // Set editor content
        if (editor && data.note.content) {
          const content = typeof data.note.content === 'string'
            ? JSON.parse(data.note.content)
            : data.note.content;
          editor.commands.setContent(content);
          setOriginalContent(content);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchNote();
    }
  }, [token, editor]);

  // Save author name to localStorage
  useEffect(() => {
    if (authorName) {
      localStorage.setItem('shared_note_author', authorName);
    }
  }, [authorName]);

  // Handle entering edit mode
  const handleStartEditing = () => {
    if (editor && noteData?.permissions?.allow_edits) {
      setOriginalContent(editor.getJSON());
      editor.setEditable(true);
      setIsEditing(true);
    }
  };

  // Handle saving edits
  const handleSaveEdits = async () => {
    if (!editor || !authorName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/note-share/public/${token}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName,
          content_json: editor.getJSON(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error guardando ediciones');
      }

      // Reset to view mode
      editor.setEditable(false);
      setIsEditing(false);
      alert('Ediciones guardadas. El equipo las revisará pronto.');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancel editing
  const handleCancelEdit = () => {
    if (editor && originalContent) {
      editor.commands.setContent(originalContent);
    }
    editor?.setEditable(false);
    setIsEditing(false);
  };

  // Add comment (supports replies via parent_id)
  const handleAddComment = async (commentData) => {
    try {
      const response = await fetch(`${API_BASE}/api/note-share/public/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author_name: authorName,
          content: commentData.content,
          selection_from: commentData.selection_from,
          selection_to: commentData.selection_to,
          quoted_text: commentData.quoted_text,
          parent_id: commentData.parent_id || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error agregando comentario');
      }

      const newComment = await response.json();
      // Add to comments list - will be organized into threads by the sidebar
      setComments([newComment, ...comments]);
      setSelectedText(null);
    } catch (err) {
      alert(err.message);
    }
  };

  // Fetch comments
  const refreshComments = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/note-share/public/${token}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error refreshing comments:', err);
    }
  }, [token]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">Cargando nota...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} className="text-red-500" />
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">
            Enlace no válido
          </h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const { note, permissions } = noteData || {};

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: note?.color || '#e2e8f0' }}
            >
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-slate-800 line-clamp-1">
                {note?.title || 'Sin título'}
              </h1>
              <p className="text-xs text-slate-400">Compartido contigo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle comments button (mobile) */}
            <button
              onClick={() => setShowComments(!showComments)}
              className={`p-2 rounded-lg transition-colors md:hidden ${
                showComments ? 'bg-slate-100 text-slate-700' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <MessageSquare size={20} />
            </button>

            {/* Edit controls */}
            {permissions?.allow_edits && (
              isEditing ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdits}
                    disabled={isSaving || !authorName.trim()}
                    className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Enviar ediciones
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStartEditing}
                  className="px-3 py-1.5 text-sm bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2a2a3e] transition-colors flex items-center gap-1"
                >
                  <Edit3 size={14} />
                  Editar
                </button>
              )
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Editor area */}
        <main className="flex-1 p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            {/* Author name input (required for comments/edits) */}
            {(permissions?.allow_comments || permissions?.allow_edits) && !authorName && (
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800 mb-2">
                  Para comentar o editar, ingresa tu nombre:
                </p>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Tu nombre"
                  className="w-full max-w-xs px-3 py-2 text-sm border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            )}

            {/* Editing mode notice */}
            {isEditing && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <Edit3 size={16} className="text-red-600" />
                <p className="text-sm text-red-700">
                  <strong>Modo edición activo.</strong> Tus cambios aparecerán resaltados para revisión del equipo.
                </p>
              </div>
            )}

            {/* Note content */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <EditorContent
                editor={editor}
                className="prose prose-sm max-w-none"
              />
              <style>{`
                .ProseMirror {
                  padding: 2rem;
                  min-height: 400px;
                  outline: none;
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
                .ProseMirror img {
                  max-width: 100%;
                  height: auto;
                  border-radius: 0.5rem;
                  margin: 1rem 0;
                }
                .ProseMirror .video-embed-wrapper {
                  margin: 1rem 0;
                  padding: 1rem;
                  background: #f8fafc;
                  border-radius: 0.75rem;
                  border: 1px solid #e2e8f0;
                }
                .ProseMirror .video-embed-container {
                  position: relative;
                  padding-bottom: 56.25%;
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
                /* Client edit mark styles */
                .ProseMirror span[data-client-edit] {
                  color: #DC2626;
                  background-color: #FEE2E2;
                  border-radius: 2px;
                  padding: 0 2px;
                }
              `}</style>
            </div>
          </div>
        </main>

        {/* Comments sidebar */}
        {showComments && permissions?.allow_comments && (
          <div className="hidden md:block">
            <NoteCommentsSidebar
              comments={comments}
              onAddComment={handleAddComment}
              selectedText={selectedText}
              authorName={authorName}
              onAuthorNameChange={setAuthorName}
              isPublicView={true}
              allowComments={permissions?.allow_comments}
            />
          </div>
        )}

        {/* Mobile comments overlay */}
        {showComments && permissions?.allow_comments && (
          <div className="fixed inset-0 bg-black/50 z-50 md:hidden">
            <div className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl animate-slide-in">
              <button
                onClick={() => setShowComments(false)}
                className="absolute top-3 right-3 p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
              <NoteCommentsSidebar
                comments={comments}
                onAddComment={handleAddComment}
                selectedText={selectedText}
                authorName={authorName}
                onAuthorNameChange={setAuthorName}
                isPublicView={true}
                allowComments={permissions?.allow_comments}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-400">
        Compartido con AgenciaPro
      </footer>
    </div>
  );
};

export default SharedNoteView;
