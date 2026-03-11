import { useState, useEffect, useMemo } from 'react';
import { CheckSquare, FolderKanban, StickyNote, User, Calendar, Flag, Folder } from 'lucide-react';
import { chatAPI } from '../../utils/api';
import EntityDetailModal from './EntityDetailModal';

// Cache for entity previews
const previewCache = new Map();

const STATUS_COLORS = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pendiente' },
  in_progress: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En progreso' },
  completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
  done: { bg: 'bg-green-100', text: 'text-green-700', label: 'Completada' },
  active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Activo' },
  blocked: { bg: 'bg-red-100', text: 'text-red-700', label: 'Bloqueada' },
  review: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En revisión' },
};

const PRIORITY_COLORS = {
  high: 'text-red-500',
  medium: 'text-yellow-500',
  low: 'text-green-500',
  urgent: 'text-red-600',
};

const EntityPreviewCard = ({ type, id }) => {
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    const cacheKey = `${type}-${id}`;
    if (previewCache.has(cacheKey)) {
      setPreview(previewCache.get(cacheKey));
      setLoading(false);
      return;
    }

    chatAPI.getEntityPreview(type, id)
      .then((res) => {
        previewCache.set(cacheKey, res.data);
        setPreview(res.data);
      })
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [type, id]);

  if (loading) {
    return (
      <div className="mt-1.5 p-2.5 bg-white/10 rounded-xl animate-pulse">
        <div className="h-3 bg-gray-300/30 rounded w-3/4 mb-2" />
        <div className="h-2.5 bg-gray-300/20 rounded w-1/2" />
      </div>
    );
  }

  if (!preview) return null;

  const statusInfo = STATUS_COLORS[preview.status] || { bg: 'bg-gray-100', text: 'text-gray-600', label: preview.status };
  const isTask = type === 'task';
  const isNote = type === 'note';
  const title = isTask ? preview.title : isNote ? preview.title : preview.name;
  const accentBg = isTask ? 'bg-blue-50' : isNote ? 'bg-amber-50' : 'bg-purple-50';
  const accentText = isTask ? 'text-blue-600' : isNote ? 'text-amber-600' : 'text-purple-600';
  const Icon = isTask ? CheckSquare : isNote ? StickyNote : FolderKanban;

  return (
    <>
      <button onClick={() => setShowDetail(true)} className="block mt-1.5 w-full text-left group/card">
        <div className="p-3 bg-white border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
          <div className="flex items-start gap-2.5">
            <div className={`p-1.5 ${accentBg} rounded-lg flex-shrink-0 mt-0.5`}>
              <Icon size={14} className={accentText} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium text-gray-800 truncate group-hover/card:${accentText} transition-colors`}>
                {title}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {!isNote && (
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                    {statusInfo.label}
                  </span>
                )}
                {isTask && preview.priority && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] ${PRIORITY_COLORS[preview.priority] || 'text-gray-500'}`}>
                    <Flag size={10} /> {preview.priority}
                  </span>
                )}
                {isTask && preview.assigned_to_name && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                    <User size={10} /> {preview.assigned_to_name}
                  </span>
                )}
                {!isTask && !isNote && preview.client_name && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                    <User size={10} /> {preview.client_name}
                  </span>
                )}
                {isNote && preview.category_name && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">
                    {preview.category_name}
                  </span>
                )}
                {isNote && preview.folder_name && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                    <Folder size={10} /> {preview.folder_name}
                  </span>
                )}
                {isNote && preview.created_by_name && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                    <User size={10} /> {preview.created_by_name}
                  </span>
                )}
                {(preview.due_date || preview.deadline) && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500">
                    <Calendar size={10} />
                    {new Date(preview.due_date || preview.deadline).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
              {isTask && preview.project_name && (
                <p className="text-[10px] text-gray-400 mt-1 truncate">{preview.project_name}</p>
              )}
            </div>
          </div>
        </div>
      </button>

      {showDetail && (
        <EntityDetailModal type={type} id={id} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
};

const MessageBubble = ({ message, isOwn, showSender }) => {
  const mentions = useMemo(() => {
    if (!message.entity_mentions) return [];
    try {
      const parsed = typeof message.entity_mentions === 'string'
        ? JSON.parse(message.entity_mentions)
        : message.entity_mentions;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [message.entity_mentions]);

  const renderContent = (content) => {
    if (mentions.length === 0) return content;

    const parts = [];
    let remaining = content;

    for (const mention of mentions) {
      const idx = remaining.indexOf(mention.label);
      if (idx === -1) continue;

      if (idx > 0) parts.push(remaining.substring(0, idx));

      parts.push(
        <span
          key={`${mention.type}-${mention.id}`}
          className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold ${
            isOwn
              ? 'bg-white/20 text-blue-200'
              : 'bg-blue-100 text-blue-700'
          }`}
        >
          {mention.label}
        </span>
      );

      remaining = remaining.substring(idx + mention.label.length);
    }

    if (remaining) parts.push(remaining);
    return parts.length > 0 ? parts : content;
  };

  if (message.message_type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
          {message.content}
        </span>
      </div>
    );
  }

  const time = new Date(message.created_at).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}>
      <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
        {showSender && !isOwn && (
          <p className="text-xs font-medium text-gray-500 mb-0.5 ml-3">{message.sender_name}</p>
        )}
        <div
          className={`px-3 py-2 rounded-2xl ${
            isOwn
              ? 'bg-[#1A1A2E] text-white rounded-br-md'
              : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">
            {renderContent(message.content)}
          </p>
          <p className="text-[10px] mt-1 text-right text-gray-400">
            {time}
          </p>
        </div>

        {/* Entity preview cards */}
        {mentions.length > 0 && (
          <div className="mt-1 space-y-1">
            {mentions.map((mention) => (
              <EntityPreviewCard
                key={`${mention.type}-${mention.id}`}
                type={mention.type}
                id={mention.id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
