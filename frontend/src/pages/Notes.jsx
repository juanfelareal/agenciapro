import { useState, useEffect, useRef } from 'react';
import { notesAPI, noteCategoriesAPI, noteFoldersAPI, clientsAPI, projectsAPI, teamAPI } from '../utils/api';
import NoteEditor from '../components/NoteEditor';
// import { useCollaboration } from '../hooks/useCollaboration'; // Disabled temporarily
import { useAuth } from '../context/AuthContext';
import html2pdf from 'html2pdf.js';
import {
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  X,
  Palette,
  Tag,
  Link2,
  User,
  Briefcase,
  Building2,
  FolderOpen,
  Folder,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  MoreHorizontal,
  Home,
  FileText,
  Download,
  Wifi,
  WifiOff,
  Users
} from 'lucide-react';

const NOTE_COLORS = [
  { name: 'Blanco', value: '#FFFFFF' },
  { name: 'Coral', value: '#FAAFA8' },
  { name: 'Melocotón', value: '#F39F76' },
  { name: 'Arena', value: '#FFF8B8' },
  { name: 'Menta', value: '#E2F6D3' },
  { name: 'Salvia', value: '#B4DDD3' },
  { name: 'Niebla', value: '#D4E4ED' },
  { name: 'Tormenta', value: '#AECCDC' },
  { name: 'Atardecer', value: '#D3BFDB' },
  { name: 'Flor', value: '#F6E2DD' },
];

const FOLDER_ICONS = ['📁', '📂', '🗂️', '📚', '📖', '💼', '🎯', '💡', '⭐', '🔖', '📌', '🏷️'];

const Notes = () => {
  const { user: currentUser } = useAuth();
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [flatFolders, setFlatFolders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedFolder, setSelectedFolder] = useState(null); // null = all, 'root' = no folder
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState({});

  // View state
  const [activeNote, setActiveNote] = useState(null); // For full-page view
  const [isEditing, setIsEditing] = useState(false);

  // Collaboration disabled temporarily - using standard editor
  // TODO: Fix collaboration sync issues before re-enabling
  const collabConnected = false;
  const collaboratorCount = 0;
  const collaborators = [];

  // Form data for note editing
  const [formData, setFormData] = useState({
    title: '',
    content: null,
    content_plain: '',
    color: '#FFFFFF',
    category_id: null,
    folder_id: null,
    is_pinned: false,
    links: []
  });

  // Folder modal
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);
  const [folderForm, setFolderForm] = useState({ name: '', icon: '📁', color: '#6366F1', parent_id: null });

  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '#6366F1' });
  const [editingCategory, setEditingCategory] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadNotes();
  }, [searchQuery, selectedCategory, selectedFolder, showPinnedOnly]);

  const loadInitialData = async () => {
    try {
      const [categoriesRes, foldersRes, flatFoldersRes, clientsRes, projectsRes, teamRes] = await Promise.all([
        noteCategoriesAPI.getAll(),
        noteFoldersAPI.getAll(),
        noteFoldersAPI.getFlat(),
        clientsAPI.getAll(),
        projectsAPI.getAll(),
        teamAPI.getAll()
      ]);
      setCategories(categoriesRes.data || []);
      setFolders(foldersRes.data || []);
      setFlatFolders(flatFoldersRes.data || []);
      setClients(clientsRes.data || []);
      setProjects(projectsRes.data || []);
      setTeamMembers(teamRes.data || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadNotes = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedFolder === 'root') params.folder_id = 'null';
      else if (selectedFolder) params.folder_id = selectedFolder;
      if (showPinnedOnly) params.pinned = 'true';

      const response = await notesAPI.getAll(params);
      setNotes(response.data || []);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async () => {
    try {
      const [foldersRes, flatFoldersRes] = await Promise.all([
        noteFoldersAPI.getAll(),
        noteFoldersAPI.getFlat()
      ]);
      setFolders(foldersRes.data || []);
      setFlatFolders(flatFoldersRes.data || []);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  // Open note in full-page view
  const handleOpenNote = async (note) => {
    try {
      const response = await notesAPI.getById(note.id);
      const fullNote = response.data;
      setActiveNote(fullNote);
      setFormData({
        title: fullNote.title,
        content: fullNote.content ? JSON.parse(fullNote.content) : null,
        content_plain: fullNote.content_plain || '',
        color: fullNote.color || '#FFFFFF',
        category_id: fullNote.category_id,
        folder_id: fullNote.folder_id,
        is_pinned: fullNote.is_pinned,
        links: fullNote.links || []
      });
      setIsEditing(false);
    } catch (error) {
      console.error('Error loading note:', error);
    }
  };

  // Create new note
  const handleCreateNote = () => {
    setActiveNote({ id: 'new' });
    setFormData({
      title: 'Nueva nota',
      content: null,
      content_plain: '',
      color: '#FFFFFF',
      category_id: null,
      folder_id: selectedFolder === 'root' ? null : selectedFolder,
      is_pinned: false,
      links: []
    });
    setIsEditing(true);
  };

  // Back to notes list
  const handleBackToList = () => {
    setActiveNote(null);
    setIsEditing(false);
  };

  // Save note
  const handleSaveNote = async () => {
    if (!formData.title.trim()) return;

    try {
      const data = {
        ...formData,
        content: formData.content,
        links: formData.links.filter(l => l.client_id || l.project_id || l.team_member_id)
      };

      if (activeNote?.id === 'new') {
        const response = await notesAPI.create(data);
        setActiveNote(response.data);
      } else {
        await notesAPI.update(activeNote.id, data);
      }
      setIsEditing(false);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleDeleteNote = async (id) => {
    if (!confirm('¿Eliminar esta nota?')) return;
    try {
      await notesAPI.delete(id);
      if (activeNote?.id === id) {
        setActiveNote(null);
      }
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleTogglePin = async (note) => {
    try {
      await notesAPI.togglePin(note.id);
      loadNotes();
      if (activeNote?.id === note.id) {
        setFormData(prev => ({ ...prev, is_pinned: !prev.is_pinned }));
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  };

  // Folder management
  const handleSaveFolder = async () => {
    if (!folderForm.name.trim()) return;
    try {
      if (editingFolder) {
        await noteFoldersAPI.update(editingFolder.id, folderForm);
      } else {
        await noteFoldersAPI.create(folderForm);
      }
      setShowFolderModal(false);
      setFolderForm({ name: '', icon: '📁', color: '#6366F1', parent_id: null });
      setEditingFolder(null);
      loadFolders();
    } catch (error) {
      console.error('Error saving folder:', error);
    }
  };

  const handleDeleteFolder = async (id) => {
    if (!confirm('¿Eliminar esta carpeta? Las notas se moverán a la raíz.')) return;
    try {
      await noteFoldersAPI.delete(id);
      if (selectedFolder === id) setSelectedFolder(null);
      loadFolders();
      loadNotes();
    } catch (error) {
      console.error('Error deleting folder:', error);
    }
  };

  // Category management
  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) return;
    try {
      if (editingCategory) {
        await noteCategoriesAPI.update(editingCategory.id, categoryForm);
      } else {
        await noteCategoriesAPI.create(categoryForm);
      }
      setShowCategoryModal(false);
      setCategoryForm({ name: '', color: '#6366F1' });
      setEditingCategory(null);
      loadInitialData();
    } catch (error) {
      console.error('Error saving category:', error);
    }
  };

  // Entity linking
  const handleAddLink = (type, id) => {
    const newLink = {
      client_id: type === 'client' ? id : null,
      project_id: type === 'project' ? id : null,
      team_member_id: type === 'team' ? id : null
    };
    setFormData(prev => ({
      ...prev,
      links: [...prev.links, newLink]
    }));
  };

  const handleRemoveLink = (index) => {
    setFormData(prev => ({
      ...prev,
      links: prev.links.filter((_, i) => i !== index)
    }));
  };

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId]
    }));
  };

  const getLinkedEntities = (links = []) => {
    return links.map(link => {
      if (link.client_id) {
        return { type: 'client', name: link.client_name || link.client_company, icon: Building2 };
      }
      if (link.project_id) {
        return { type: 'project', name: link.project_name, icon: Briefcase };
      }
      if (link.team_member_id) {
        return { type: 'team', name: link.member_name, icon: User };
      }
      return null;
    }).filter(Boolean);
  };

  // Convert TipTap JSON to HTML
  const tiptapToHtml = (node) => {
    if (!node) return '';

    if (node.type === 'text') {
      let text = node.text || '';
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type === 'bold') text = `<strong>${text}</strong>`;
          if (mark.type === 'italic') text = `<em>${text}</em>`;
          if (mark.type === 'highlight') text = `<mark>${text}</mark>`;
          if (mark.type === 'code') text = `<code>${text}</code>`;
        });
      }
      return text;
    }

    const children = node.content ? node.content.map(tiptapToHtml).join('') : '';

    switch (node.type) {
      case 'doc':
        return children;
      case 'paragraph':
        return `<p>${children || '&nbsp;'}</p>`;
      case 'heading':
        return `<h${node.attrs?.level || 1}>${children}</h${node.attrs?.level || 1}>`;
      case 'bulletList':
        return `<ul>${children}</ul>`;
      case 'orderedList':
        return `<ol>${children}</ol>`;
      case 'listItem':
        return `<li>${children}</li>`;
      case 'taskList':
        return `<ul class="task-list">${children}</ul>`;
      case 'taskItem':
        const checked = node.attrs?.checked ? 'checked' : '';
        const checkedStyle = node.attrs?.checked ? 'text-decoration: line-through; color: #94a3b8;' : '';
        return `<li class="task-item"><input type="checkbox" ${checked} disabled style="margin-right: 8px;"/><span style="${checkedStyle}">${children}</span></li>`;
      case 'blockquote':
        return `<blockquote>${children}</blockquote>`;
      case 'codeBlock':
        return `<pre><code>${children}</code></pre>`;
      case 'hardBreak':
        return '<br/>';
      default:
        return children;
    }
  };

  // Export note to PDF
  const handleExportPDF = async () => {
    // Convert TipTap content to HTML
    const contentHtml = formData.content ? tiptapToHtml(formData.content) : (formData.content_plain || 'Sin contenido');

    // Get category info
    const category = formData.category_id ? categories.find(c => c.id === formData.category_id) : null;

    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    document.body.appendChild(container);

    // Create content div
    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = 'padding: 40px; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; color: #1e293b; background-color: #ffffff;';

    // Add logo
    const logoDiv = document.createElement('div');
    logoDiv.style.cssText = 'margin-bottom: 32px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;';
    const logoImg = document.createElement('img');
    logoImg.src = window.location.origin + '/logo-lareal.png';
    logoImg.style.cssText = 'height: 96px; opacity: 0.9;';
    logoImg.crossOrigin = 'anonymous';
    logoDiv.appendChild(logoImg);
    contentDiv.appendChild(logoDiv);

    // Add title
    const titleEl = document.createElement('h1');
    titleEl.textContent = formData.title;
    titleEl.style.cssText = 'font-size: 28px; font-weight: 700; margin: 0 0 16px 0; color: #0f172a;';
    contentDiv.appendChild(titleEl);

    // Add category badge
    if (category) {
      const badgeEl = document.createElement('span');
      badgeEl.textContent = category.name;
      badgeEl.style.cssText = `display: inline-block; padding: 6px 16px; font-size: 12px; font-weight: 500; border-radius: 6px; background-color: ${category.color}20; color: ${category.color}; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;`;
      contentDiv.appendChild(badgeEl);
    }

    // Add content
    const noteContent = document.createElement('div');
    noteContent.style.cssText = 'font-size: 14px; line-height: 1.7; margin-top: 24px;';
    noteContent.innerHTML = contentHtml;

    // Apply styles to content elements
    noteContent.querySelectorAll('h1').forEach(el => el.style.cssText = 'font-size: 22px; font-weight: 700; margin: 24px 0 12px 0;');
    noteContent.querySelectorAll('h2').forEach(el => el.style.cssText = 'font-size: 18px; font-weight: 600; margin: 20px 0 10px 0;');
    noteContent.querySelectorAll('p').forEach(el => el.style.cssText = 'margin: 0 0 12px 0;');
    noteContent.querySelectorAll('ul, ol').forEach(el => el.style.cssText = 'padding-left: 24px; margin: 0 0 12px 0;');
    noteContent.querySelectorAll('li').forEach(el => el.style.cssText = 'margin-bottom: 6px;');
    noteContent.querySelectorAll('blockquote').forEach(el => el.style.cssText = 'border-left: 3px solid #cbd5e1; padding-left: 16px; margin: 0 0 12px 0; color: #64748b; font-style: italic;');
    noteContent.querySelectorAll('code').forEach(el => el.style.cssText = 'background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 13px;');
    noteContent.querySelectorAll('pre').forEach(el => el.style.cssText = 'background-color: #1e293b; color: #e2e8f0; padding: 16px; border-radius: 8px; overflow: auto; margin: 0 0 12px 0;');
    noteContent.querySelectorAll('mark').forEach(el => el.style.cssText = 'background-color: #fef08a; padding: 1px 4px; border-radius: 2px;');
    contentDiv.appendChild(noteContent);

    // Add footer
    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;';
    footer.textContent = `Generado el ${new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
    contentDiv.appendChild(footer);

    container.appendChild(contentDiv);

    // Wait for logo to load
    await new Promise(resolve => {
      if (logoImg.complete) {
        resolve();
      } else {
        logoImg.onload = resolve;
        logoImg.onerror = resolve; // Continue even if logo fails
      }
    });

    // Small delay to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 200));

    // Generate PDF
    const opt = {
      margin: 10,
      filename: `${formData.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ\s]/g, '') || 'nota'}.pdf`,
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await html2pdf().set(opt).from(contentDiv).save();
    } catch (error) {
      console.error('Error generating PDF:', error);
      // Try without logo if it fails
      try {
        logoDiv.remove();
        await html2pdf().set(opt).from(contentDiv).save();
      } catch (err) {
        console.error('Error generating PDF without logo:', err);
        alert('Error al generar el PDF. Por favor intenta de nuevo.');
      }
    } finally {
      document.body.removeChild(container);
    }
  };

  // Render folder tree
  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map(folder => (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors group ${
            selectedFolder === folder.id
              ? 'bg-gray-100 text-[#1A1A2E]'
              : 'hover:bg-slate-100 text-slate-700'
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
          onClick={() => setSelectedFolder(folder.id)}
        >
          {folder.children?.length > 0 ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFolderExpanded(folder.id);
              }}
              className="p-0.5 hover:bg-slate-200 rounded"
            >
              {expandedFolders[folder.id] ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="text-base">{folder.icon}</span>
          <span className="flex-1 text-sm font-medium truncate">{folder.name}</span>
          <span className="text-xs text-slate-400">{folder.note_count}</span>
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingFolder(folder);
                setFolderForm({ name: folder.name, icon: folder.icon, color: folder.color, parent_id: folder.parent_id });
                setShowFolderModal(true);
              }}
              className="p-1 hover:bg-slate-200 rounded"
            >
              <Edit3 size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteFolder(folder.id);
              }}
              className="p-1 hover:bg-slate-200 rounded text-red-500"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
        {expandedFolders[folder.id] && folder.children?.length > 0 && (
          <div>{renderFolderTree(folder.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  // Full-page note view
  if (activeNote) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: formData.color }}>
        {/* Top bar */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 border-b border-slate-200/50 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBackToList}
              className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={18} />
              Volver
            </button>
            {activeNote.id !== 'new' && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                {formData.folder_id && flatFolders.find(f => f.id === formData.folder_id) && (
                  <>
                    <span>{flatFolders.find(f => f.id === formData.folder_id)?.icon}</span>
                    <span>{flatFolders.find(f => f.id === formData.folder_id)?.name}</span>
                    <span>/</span>
                  </>
                )}
                <FileText size={14} />
              </div>
            )}

            {/* Collaboration status indicator */}
            {isEditing && activeNote.id !== 'new' && (
              <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
                {/* Connection indicator */}
                <div className={`flex items-center gap-1.5 text-sm ${collabConnected ? 'text-green-600' : 'text-slate-400'}`}>
                  {collabConnected ? (
                    <>
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                      </span>
                      <span className="hidden sm:inline">En vivo</span>
                    </>
                  ) : (
                    <>
                      <WifiOff size={14} />
                      <span className="hidden sm:inline">Desconectado</span>
                    </>
                  )}
                </div>

                {/* Collaborators */}
                {collaboratorCount > 1 && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-600">
                    <Users size={14} />
                    <span>{collaboratorCount} editando</span>
                  </div>
                )}

                {/* Collaborator avatars */}
                {collaborators.length > 0 && (
                  <div className="flex -space-x-2">
                    {collaborators.slice(0, 3).map((collab, idx) => (
                      <div
                        key={collab.clientId || idx}
                        className="w-7 h-7 rounded-full border-2 border-white flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: collab.color }}
                        title={collab.name}
                      >
                        {collab.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                    ))}
                    {collaborators.length > 3 && (
                      <div className="w-7 h-7 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                        +{collaborators.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={!formData.title.trim()}
                  className="px-4 py-1.5 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] disabled:opacity-50"
                >
                  Guardar
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleTogglePin(activeNote)}
                  className={`p-2 rounded-lg ${formData.is_pinned ? 'text-amber-500' : 'text-slate-500'} hover:bg-slate-100`}
                >
                  {formData.is_pinned ? <PinOff size={18} /> : <Pin size={18} />}
                </button>
                <button
                  onClick={handleExportPDF}
                  className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                  title="Exportar a PDF"
                >
                  <Download size={16} />
                  Exportar PDF
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  <Edit3 size={16} />
                  Editar
                </button>
                <button
                  onClick={() => handleDeleteNote(activeNote.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                >
                  <Trash2 size={18} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Note content */}
        <div className="max-w-4xl mx-auto px-6 py-8">
          {/* Title */}
          {isEditing ? (
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Título de la nota"
              className="w-full text-4xl font-bold bg-transparent border-none outline-none placeholder:text-slate-400 mb-6"
              autoFocus
            />
          ) : (
            <h1 className="text-4xl font-bold text-slate-800 mb-6">{formData.title}</h1>
          )}

          {/* Meta info */}
          {isEditing && (
            <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-slate-200/50">
              {/* Folder select */}
              <div className="flex items-center gap-2">
                <Folder size={16} className="text-slate-500" />
                <select
                  value={formData.folder_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, folder_id: e.target.value || null }))}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white/80"
                >
                  <option value="">Sin carpeta</option>
                  {flatFolders.map(f => (
                    <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                  ))}
                </select>
              </div>

              {/* Category select */}
              <div className="flex items-center gap-2">
                <Tag size={16} className="text-slate-500" />
                <select
                  value={formData.category_id || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value || null }))}
                  className="px-2 py-1 text-sm border border-slate-200 rounded-lg bg-white/80"
                >
                  <option value="">Sin categoría</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Color picker */}
              <div className="flex items-center gap-2">
                <Palette size={16} className="text-slate-500" />
                <div className="flex gap-1">
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.value}
                      onClick={() => setFormData(prev => ({ ...prev, color: color.value }))}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                        formData.color === color.value ? 'border-[#1A1A2E]' : 'border-slate-200'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category badge (view mode) */}
          {!isEditing && formData.category_id && (
            <div className="mb-4">
              {categories.find(c => c.id === formData.category_id) && (
                <span
                  className="inline-block px-3 py-1 text-sm rounded-full"
                  style={{
                    backgroundColor: `${categories.find(c => c.id === formData.category_id)?.color}20`,
                    color: categories.find(c => c.id === formData.category_id)?.color
                  }}
                >
                  {categories.find(c => c.id === formData.category_id)?.name}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="prose prose-slate max-w-none">
            {isEditing ? (
              // Standard editor for all notes (collaboration disabled temporarily)
              <NoteEditor
                key={activeNote.id}
                content={formData.content}
                onChange={({ json, text }) => setFormData(prev => ({
                  ...prev,
                  content: json,
                  content_plain: text
                }))}
                placeholder="Escribe tu nota aquí..."
                minHeight="400px"
              />
            ) : (
              <NoteEditor
                content={formData.content}
                onChange={() => {}}
                placeholder=""
                minHeight="200px"
                readOnly
              />
            )}
          </div>

          {/* Links section */}
          {isEditing && (
            <div className="mt-8 pt-6 border-t border-slate-200/50">
              <div className="flex items-center gap-2 mb-4">
                <Link2 size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Vincular a:</span>
              </div>

              {formData.links.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {formData.links.map((link, idx) => {
                    let entity = null;
                    if (link.client_id) {
                      const client = clients.find(c => c.id === link.client_id);
                      entity = { name: client?.name || client?.company || 'Cliente', icon: Building2 };
                    } else if (link.project_id) {
                      const project = projects.find(p => p.id === link.project_id);
                      entity = { name: project?.name || 'Proyecto', icon: Briefcase };
                    } else if (link.team_member_id) {
                      const member = teamMembers.find(m => m.id === link.team_member_id);
                      entity = { name: member?.name || 'Miembro', icon: User };
                    }
                    if (!entity) return null;

                    return (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-lg text-sm"
                      >
                        <entity.icon size={14} />
                        {entity.name}
                        <button
                          onClick={() => handleRemoveLink(idx)}
                          className="ml-1 hover:text-red-500"
                        >
                          <X size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddLink('client', parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">+ Cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name || c.company}</option>
                  ))}
                </select>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddLink('project', parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">+ Proyecto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleAddLink('team', parseInt(e.target.value));
                      e.target.value = '';
                    }
                  }}
                  className="px-2 py-1.5 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  <option value="">+ Miembro equipo</option>
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Links display (view mode) */}
          {!isEditing && formData.links?.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200/50">
              <div className="flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-slate-500" />
                <span className="text-sm font-medium text-slate-700">Vinculado a:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {getLinkedEntities(formData.links).map((entity, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-sm"
                  >
                    <entity.icon size={14} />
                    {entity.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Notes list view with folder sidebar
  return (
    <div className="flex bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ minHeight: '600px', height: 'calc(100vh - 180px)' }}>
      {/* Folder Sidebar */}
      <div className="w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Carpetas</h2>
            <button
              onClick={() => {
                setEditingFolder(null);
                setFolderForm({ name: '', icon: '📁', color: '#6366F1', parent_id: null });
                setShowFolderModal(true);
              }}
              className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg"
              title="Nueva carpeta"
            >
              <FolderPlus size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {/* All Notes */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedFolder === null
                ? 'bg-gray-100 text-[#1A1A2E]'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            onClick={() => setSelectedFolder(null)}
          >
            <Home size={16} />
            <span className="flex-1 text-sm font-medium">Todas las notas</span>
            <span className="text-xs text-slate-400">{notes.length}</span>
          </div>

          {/* Unfiled Notes */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
              selectedFolder === 'root'
                ? 'bg-gray-100 text-[#1A1A2E]'
                : 'hover:bg-slate-100 text-slate-700'
            }`}
            onClick={() => setSelectedFolder('root')}
          >
            <FileText size={16} />
            <span className="flex-1 text-sm font-medium">Sin carpeta</span>
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-slate-200" />

          {/* Folder Tree */}
          {renderFolderTree(folders)}
        </div>

        {/* Categories */}
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 uppercase">Categorías</span>
            <button
              onClick={() => setShowCategoryModal(true)}
              className="text-xs text-[#1A1A2E] hover:text-[#1A1A2E]"
            >
              Gestionar
            </button>
          </div>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(e.target.value || null)}
            className="w-full px-2 py-1.5 text-sm border border-slate-200 rounded-lg"
          >
            <option value="">Todas</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A2E] tracking-tight">
              {selectedFolder === null
                ? 'Todas las notas'
                : selectedFolder === 'root'
                ? 'Sin carpeta'
                : flatFolders.find(f => f.id === selectedFolder)?.name || 'Notas'}
            </h1>
            <p className="text-sm text-slate-500">{notes.length} notas</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar..."
                className="pl-9 pr-4 py-2 w-64 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-300"
              />
            </div>

            {/* Pinned filter */}
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                showPinnedOnly
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Pin size={16} />
              Fijadas
            </button>

            {/* New Note */}
            <button
              onClick={handleCreateNote}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] transition-colors"
            >
              <Plus size={18} />
              Nueva Nota
            </button>
          </div>
        </div>

        {/* Notes Grid */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Cargando notas...</div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
                <FileText size={32} className="text-slate-400" />
              </div>
              <p className="text-slate-500 mb-4">No hay notas aquí</p>
              <button
                onClick={handleCreateNote}
                className="text-[#1A1A2E] hover:text-[#1A1A2E] font-medium"
              >
                Crear una nota
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {notes.map(note => (
                <div
                  key={note.id}
                  className="group relative rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer"
                  style={{ backgroundColor: note.color || '#FFFFFF' }}
                  onClick={() => handleOpenNote(note)}
                >
                  {/* Pinned indicator */}
                  {note.is_pinned === 1 && (
                    <div className="absolute top-3 right-3">
                      <Pin size={16} className="text-amber-500 fill-amber-500" />
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-4 min-h-[140px]">
                    <h3 className="font-semibold text-slate-800 mb-2 pr-6 line-clamp-2">{note.title}</h3>
                    <p className="text-sm text-slate-600 line-clamp-3">
                      {note.content_plain || 'Sin contenido'}
                    </p>
                  </div>

                  {/* Footer */}
                  <div className="px-4 pb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {note.folder_name && (
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <span>{note.folder_icon}</span>
                          {note.folder_name}
                        </span>
                      )}
                      {note.category_name && (
                        <span
                          className="inline-block px-2 py-0.5 text-xs rounded-full"
                          style={{
                            backgroundColor: `${note.category_color}20`,
                            color: note.category_color
                          }}
                        >
                          {note.category_name}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Hover actions */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-white/95 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleTogglePin(note)}
                        className="p-1.5 rounded hover:bg-black/5"
                      >
                        {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-1.5 rounded hover:bg-black/5 text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">
                {editingFolder ? 'Editar Carpeta' : 'Nueva Carpeta'}
              </h2>
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setEditingFolder(null);
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={folderForm.name}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de la carpeta"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Icono</label>
                <div className="flex flex-wrap gap-2">
                  {FOLDER_ICONS.map(icon => (
                    <button
                      key={icon}
                      onClick={() => setFolderForm(prev => ({ ...prev, icon }))}
                      className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                        folderForm.icon === icon
                          ? 'border-[#1A1A2E] bg-gray-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Carpeta padre</label>
                <select
                  value={folderForm.parent_id || ''}
                  onChange={(e) => setFolderForm(prev => ({ ...prev, parent_id: e.target.value || null }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="">Ninguna (raíz)</option>
                  {flatFolders
                    .filter(f => f.id !== editingFolder?.id)
                    .map(f => (
                      <option key={f.id} value={f.id}>{f.icon} {f.name}</option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
              <button
                onClick={() => {
                  setShowFolderModal(false);
                  setEditingFolder(null);
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveFolder}
                disabled={!folderForm.name.trim()}
                className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] disabled:opacity-50"
              >
                {editingFolder ? 'Guardar' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold">Gestionar Categorías</h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setEditingCategory(null);
                  setCategoryForm({ name: '', color: '#6366F1' });
                }}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-10 h-10 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nombre de categoría"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg"
                />
                <button
                  onClick={handleSaveCategory}
                  disabled={!categoryForm.name.trim()}
                  className="px-4 py-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#1A1A2E] disabled:opacity-50"
                >
                  {editingCategory ? 'Guardar' : 'Agregar'}
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {categories.map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span>{cat.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingCategory(cat);
                          setCategoryForm({ name: cat.name, color: cat.color });
                        }}
                        className="p-1 hover:bg-slate-200 rounded"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={async () => {
                          if (confirm('¿Eliminar esta categoría?')) {
                            await noteCategoriesAPI.delete(cat.id);
                            loadInitialData();
                          }
                        }}
                        className="p-1 hover:bg-slate-200 rounded text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && (
                  <p className="text-center text-slate-500 py-4">
                    No hay categorías creadas
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Generate consistent color for a user based on ID
const getRandomColor = (userId) => {
  const colors = [
    '#F87171', // red
    '#FB923C', // orange
    '#FBBF24', // amber
    '#4ADE80', // green
    '#22D3EE', // cyan
    '#60A5FA', // blue
    '#A78BFA', // violet
    '#F472B6', // pink
  ];
  if (!userId) return colors[0];
  const index = typeof userId === 'number' ? userId : userId.toString().charCodeAt(0);
  return colors[index % colors.length];
};

export default Notes;
