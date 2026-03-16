import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MessageCircle, Plus, Search, Send, Hash, ArrowDown, Paperclip, X, Image as ImageIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { chatAPI } from '../utils/api';
import useChat from '../hooks/useChat';
import MessageBubble from '../components/chat/MessageBubble';
import MentionAutocomplete from '../components/chat/MentionAutocomplete';
import NewConversationModal from '../components/chat/NewConversationModal';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '');

const Chat = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null);
  const [entityMentions, setEntityMentions] = useState([]);
  const [showNewModal, setShowNewModal] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [pendingImage, setPendingImage] = useState(null); // { file, preview }
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  const { connected, onlineUsers, typingUsers, sendMessage, markRead, startTyping, stopTyping, onNewMessage, onMessageSent } = useChat(user);

  // Load conversations (only after user is ready)
  const loadConversations = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await chatAPI.getConversations();
      setConversations(res.data);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoadingConvs(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages when conversation selected
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoadingMessages(true);
        const res = await chatAPI.getMessages(conversationId, { limit: 50 });
        setMessages(res.data);
        scrollToBottom();
        // Mark as read
        markRead(conversationId);
        await chatAPI.markRead(conversationId);
      } catch (err) {
        console.error('Error loading messages:', err);
      } finally {
        setLoadingMessages(false);
      }
    };

    loadMessages();
  }, [conversationId, markRead]);

  // Socket listeners
  useEffect(() => {
    onNewMessage((msg) => {
      if (String(msg.conversation_id) === String(conversationId)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
        markRead(conversationId);
        chatAPI.markRead(conversationId).catch(() => {});
      }
      // Update conversation list preview
      loadConversations();
    });

    onMessageSent((msg) => {
      if (String(msg.conversation_id) === String(conversationId)) {
        setMessages((prev) => [...prev, msg]);
        scrollToBottom();
      }
      loadConversations();
    });
  }, [conversationId, onNewMessage, onMessageSent, markRead, loadConversations]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollBtn(!isNearBottom);
  };

  // Handle input changes with mention detection
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect # mentions
    const cursorPos = e.target.selectionStart;
    const textBefore = val.substring(0, cursorPos);
    const hashMatch = textBefore.match(/#(\w*)$/);

    if (hashMatch) {
      setMentionQuery(hashMatch[1]);
    } else {
      setMentionQuery(null);
    }

    // Typing indicator
    if (conversationId) {
      startTyping(conversationId);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(conversationId);
      }, 2000);
    }
  };

  const handleMentionSelect = (entity) => {
    const label = entity.type === 'task' ? `#T-${entity.id}` : entity.type === 'note' ? `#N-${entity.id}` : `#P-${entity.id}`;
    // Replace the #query with the label
    const cursorPos = inputRef.current.selectionStart;
    const textBefore = inputValue.substring(0, cursorPos);
    const textAfter = inputValue.substring(cursorPos);
    const newBefore = textBefore.replace(/#\w*$/, label + ' ');

    setInputValue(newBefore + textAfter);
    setEntityMentions((prev) => [...prev, { type: entity.type, id: entity.id, label, title: entity.title }]);
    setMentionQuery(null);
    inputRef.current.focus();
  };

  // Image handling
  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('La imagen no puede superar 10MB');
      return;
    }
    const preview = URL.createObjectURL(file);
    setPendingImage({ file, preview });
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        handleImageFile(file);
        return;
      }
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
    e.target.value = '';
  };

  const cancelImage = () => {
    if (pendingImage?.preview) URL.revokeObjectURL(pendingImage.preview);
    setPendingImage(null);
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && !pendingImage) || !conversationId) return;

    if (pendingImage) {
      // Upload image via REST, then broadcast via socket
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('image', pendingImage.file);
        if (inputValue.trim()) formData.append('content', inputValue.trim());

        const res = await chatAPI.uploadImage(conversationId, formData);
        const savedMsg = res.data;

        // Add to local messages immediately
        setMessages((prev) => [...prev, savedMsg]);
        scrollToBottom();

        // Broadcast to other users via socket
        sendMessage({
          conversationId: Number(conversationId),
          content: savedMsg.content || '',
          imageUrl: savedMsg.image_url,
          messageType: 'image',
        });

        cancelImage();
        setInputValue('');
        loadConversations();
      } catch (err) {
        console.error('Error uploading image:', err);
        alert('Error al subir la imagen');
      } finally {
        setUploading(false);
      }
    } else {
      // Text message via socket
      sendMessage({
        conversationId: Number(conversationId),
        content: inputValue.trim(),
        entityMentions: entityMentions.length > 0 ? entityMentions : undefined,
      });

      setInputValue('');
      setEntityMentions([]);
    }

    stopTyping(conversationId);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Drop handler
  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      handleImageFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getConversationName = (conv) => {
    if (conv.name) return conv.name;
    if (conv.type === 'direct' && conv.members) {
      const other = conv.members.find((m) => m.team_member_id !== user?.id);
      return other?.name || 'Chat';
    }
    return 'Chat';
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const isOnline = (conv) => {
    if (conv.type !== 'direct' || !conv.members) return false;
    const other = conv.members.find((m) => m.team_member_id !== user?.id);
    return other && onlineUsers.includes(other.team_member_id);
  };

  const currentConversation = conversations.find((c) => String(c.id) === String(conversationId));
  const filteredConversations = conversations.filter((c) =>
    getConversationName(c).toLowerCase().includes(searchFilter.toLowerCase())
  );

  const convTyping = conversationId ? typingUsers[conversationId] : {};
  const typingNames = convTyping ? Object.values(convTyping).filter((n) => n !== user?.name) : [];

  // Group messages by date
  const groupedMessages = [];
  let lastDate = '';
  for (const msg of messages) {
    const date = new Date(msg.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    if (date !== lastDate) {
      groupedMessages.push({ type: 'date', date });
      lastDate = date;
    }
    groupedMessages.push({ type: 'message', ...msg });
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mx-6 -my-8">
      {/* Sidebar - Conversation List */}
      <div className="w-[320px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-gray-800">Chat</h1>
            <button
              onClick={() => setShowNewModal(true)}
              className="p-2 bg-[#1A1A2E] text-white rounded-lg hover:bg-[#2A2A3E] transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Buscar conversación..."
              className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20"
            />
          </div>
        </div>

        {/* Conversations */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando...</div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              No tienes conversaciones aún
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const name = getConversationName(conv);
              const active = String(conv.id) === String(conversationId);
              const online = isOnline(conv);

              return (
                <button
                  key={conv.id}
                  onClick={() => navigate(`/app/chat/${conv.id}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    active ? 'bg-[#1A1A2E]/5 border-r-2 border-[#1A1A2E]' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold ${
                      conv.type === 'group'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-[#1A1A2E] text-white'
                    }`}>
                      {conv.type === 'group' ? <Hash size={16} /> : getInitials(name)}
                    </div>
                    {online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">{name}</span>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">
                          {new Date(conv.last_message_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-xs text-gray-500 truncate">
                        {conv.last_message || 'Sin mensajes'}
                      </span>
                      {conv.unread_count > 0 && (
                        <span className="ml-2 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center flex-shrink-0">
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div
        className="flex-1 flex flex-col bg-[#F8F9FA]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {!conversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">Selecciona una conversación o crea una nueva</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <div className="px-6 py-3 bg-white border-b flex items-center gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold ${
                currentConversation?.type === 'group'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-[#1A1A2E] text-white'
              }`}>
                {currentConversation?.type === 'group'
                  ? <Hash size={14} />
                  : getInitials(getConversationName(currentConversation || {}))}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">
                  {getConversationName(currentConversation || {})}
                </h2>
                <p className="text-xs text-gray-400">
                  {currentConversation?.type === 'group'
                    ? `${currentConversation?.members?.length || 0} miembros`
                    : isOnline(currentConversation || {}) ? 'En línea' : 'Desconectado'}
                </p>
              </div>
              {!connected && (
                <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
                  Reconectando...
                </span>
              )}
            </div>

            {/* Messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-6 py-4 relative"
            >
              {loadingMessages ? (
                <div className="text-center text-gray-400 text-sm py-8">Cargando mensajes...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-8">
                  No hay mensajes aún. Envía el primero.
                </div>
              ) : (
                groupedMessages.map((item, idx) => {
                  if (item.type === 'date') {
                    return (
                      <div key={`date-${item.date}`} className="flex justify-center my-4">
                        <span className="text-xs text-gray-400 bg-gray-200 px-3 py-1 rounded-full">
                          {item.date}
                        </span>
                      </div>
                    );
                  }
                  const isOwn = item.sender_id === user?.id;
                  const prevMsg = idx > 0 ? groupedMessages[idx - 1] : null;
                  const showSender = !isOwn && (prevMsg?.type === 'date' || prevMsg?.sender_id !== item.sender_id);
                  return (
                    <MessageBubble
                      key={item.id}
                      message={item}
                      isOwn={isOwn}
                      showSender={showSender}
                      apiBase={API_BASE}
                    />
                  );
                })
              )}
              <div ref={messagesEndRef} />

              {showScrollBtn && (
                <button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 right-6 p-2 bg-white shadow-lg border rounded-full hover:bg-gray-50"
                >
                  <ArrowDown size={16} />
                </button>
              )}
            </div>

            {/* Typing indicator */}
            {typingNames.length > 0 && (
              <div className="px-6 py-1">
                <span className="text-xs text-gray-400 italic">
                  {typingNames.join(', ')} {typingNames.length === 1 ? 'está' : 'están'} escribiendo...
                </span>
              </div>
            )}

            {/* Image preview */}
            {pendingImage && (
              <div className="px-6 py-2 bg-white border-t">
                <div className="relative inline-block">
                  <img
                    src={pendingImage.preview}
                    alt="Preview"
                    className="h-24 rounded-lg border border-gray-200 object-cover"
                  />
                  <button
                    onClick={cancelImage}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="px-6 py-3 bg-white border-t relative">
              {mentionQuery !== null && (
                <MentionAutocomplete
                  query={mentionQuery}
                  onSelect={handleMentionSelect}
                  onClose={() => setMentionQuery(null)}
                />
              )}
              <div className="flex items-end gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                  title="Adjuntar imagen"
                >
                  <Paperclip size={18} />
                </button>
                <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="Escribe un mensaje... (# para mencionar)"
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 max-h-32"
                  style={{ minHeight: '40px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && !pendingImage) || uploading}
                  className="p-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#2A2A3E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  {uploading ? (
                    <div className="w-[18px] h-[18px] border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* New Conversation Modal */}
      {showNewModal && (
        <NewConversationModal
          onClose={() => setShowNewModal(false)}
          onCreated={(conv) => {
            loadConversations();
            navigate(`/app/chat/${conv.id}`);
          }}
        />
      )}
    </div>
  );
};

export default Chat;
