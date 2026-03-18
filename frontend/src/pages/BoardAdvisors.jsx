import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Landmark, Send, Loader2, Plus, RotateCcw, StopCircle,
  Trash2, MessageSquare, Settings, Users, User, ChevronLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { boardAPI } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import AdvisorFormModal from '../components/board/AdvisorFormModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const BoardAdvisors = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [currentStreamingAdvisor, setCurrentStreamingAdvisor] = useState(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showAdvisorModal, setShowAdvisorModal] = useState(false);
  const [editingAdvisor, setEditingAdvisor] = useState(null);
  const [loadingConversation, setLoadingConversation] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  // Determine mode from URL: no slug = main page, "mesa" = group chat, anything else = direct chat
  const isGroupMode = slug === 'mesa';
  const isDirectMode = slug && slug !== 'mesa';

  // Load advisors
  useEffect(() => {
    const load = async () => {
      try {
        const res = await boardAPI.getAdvisors();
        setAdvisors(res.data);
      } catch (err) {
        console.error('Error loading advisors:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Load conversations when entering chat mode
  useEffect(() => {
    if (!slug) return;
    const loadConversations = async () => {
      try {
        const res = await boardAPI.getConversations();
        // Filter: group convos for "mesa", direct convos for specific advisor
        if (isGroupMode) {
          setConversations(res.data.filter(c => c.type === 'group'));
        } else if (isDirectMode) {
          setConversations(res.data.filter(c => c.type === 'direct' && c.advisor_slug === slug));
        }
      } catch (err) {
        console.error('Error loading conversations:', err);
      }
    };
    loadConversations();
    setActiveConversationId(null);
    setActiveConversation(null);
    setMessages([]);
  }, [slug]);

  useEffect(() => {
    if (slug) setTimeout(() => inputRef.current?.focus(), 100);
  }, [slug, activeConversationId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  const currentAdvisor = isDirectMode ? advisors.find(a => a.slug === slug) : null;

  // Load conversation messages
  const loadConversation = async (convId) => {
    setLoadingConversation(true);
    try {
      const res = await boardAPI.getConversation(convId);
      setActiveConversationId(convId);
      setActiveConversation(res.data.conversation);
      setMessages(res.data.messages.map(m => ({
        role: m.role,
        content: m.content,
        advisor_id: m.advisor_id,
        advisor_name: m.advisor_name,
        advisor_slug: m.advisor_slug,
        advisor_icon: m.advisor_icon,
        advisor_color: m.advisor_color,
      })));
      scrollToBottom();
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setLoadingConversation(false);
    }
  };

  const handleNewChat = () => {
    setActiveConversationId(null);
    setActiveConversation(null);
    setMessages([]);
    inputRef.current?.focus();
  };

  const handleDeleteConversation = async (convId, e) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta conversación?')) return;
    try {
      await boardAPI.deleteConversation(convId);
      setConversations(prev => prev.filter(c => c.id !== convId));
      if (activeConversationId === convId) handleNewChat();
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || streaming) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    scrollToBottom();

    setStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Create conversation if none active
      let convId = activeConversationId;
      if (!convId) {
        const res = await boardAPI.createConversation({
          type: isGroupMode ? 'group' : 'direct',
          advisor_slug: isDirectMode ? slug : undefined,
          title: userMessage.substring(0, 80),
        });
        convId = res.data.id;
        setActiveConversationId(convId);
        setActiveConversation(res.data);
        setConversations(prev => [res.data, ...prev]);
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/board/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ message: userMessage }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Error ${response.status}`);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'advisor_start') {
              // New advisor is about to respond — add placeholder message
              setCurrentStreamingAdvisor(data);
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: '',
                streaming: true,
                advisor_id: data.advisor_id,
                advisor_name: data.advisor_name,
                advisor_slug: data.advisor_slug,
                advisor_icon: data.advisor_icon,
                advisor_color: data.advisor_color,
              }]);
              scrollToBottom();
            }

            if (data.type === 'text') {
              setMessages(prev => {
                const updated = [...prev];
                // Find the last streaming message for this advisor
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].streaming && updated[i].advisor_id === data.advisor_id) {
                    updated[i] = { ...updated[i], content: updated[i].content + data.text };
                    break;
                  }
                }
                return updated;
              });
              scrollToBottom();
            }

            if (data.type === 'advisor_done') {
              setMessages(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].advisor_id === data.advisor_id && updated[i].streaming) {
                    updated[i] = { ...updated[i], streaming: false };
                    break;
                  }
                }
                return updated;
              });
              setCurrentStreamingAdvisor(null);
            }

            if (data.type === 'advisor_error') {
              setMessages(prev => {
                const updated = [...prev];
                for (let i = updated.length - 1; i >= 0; i--) {
                  if (updated[i].advisor_id === data.advisor_id && updated[i].streaming) {
                    updated[i] = { ...updated[i], content: `Error: ${data.error}`, streaming: false, error: true };
                    break;
                  }
                }
                return updated;
              });
              setCurrentStreamingAdvisor(null);
            }

            if (data.type === 'done') {
              // All advisors done
              setConversations(prev => prev.map(c =>
                c.id === convId ? { ...c, updated_at: new Date().toISOString() } : c
              ));
            }

            if (data.type === 'error') {
              setMessages(prev => [...prev, {
                role: 'assistant',
                content: `Error: ${data.error}`,
                error: true,
              }]);
            }
          } catch { /* skip malformed JSON */ }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages(prev => prev.map(m =>
          m.streaming ? { ...m, streaming: false, content: m.content || '(Cancelado)' } : m
        ));
      } else {
        console.error('Stream error:', err);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Error: ${err.message}`,
          error: true,
        }]);
      }
    } finally {
      setStreaming(false);
      setCurrentStreamingAdvisor(null);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => abortControllerRef.current?.abort();

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAdvisorSaved = (advisor) => {
    setAdvisors(prev => {
      const idx = prev.findIndex(a => a.id === advisor.id);
      if (idx >= 0) { const u = [...prev]; u[idx] = advisor; return u; }
      return [...prev, advisor];
    });
    setShowAdvisorModal(false);
    setEditingAdvisor(null);
  };

  const handleDeleteAdvisor = async (advisorId) => {
    if (!confirm('¿Eliminar este advisor y todas sus conversaciones?')) return;
    try {
      await boardAPI.deleteAdvisor(advisorId);
      setAdvisors(prev => prev.filter(a => a.id !== advisorId));
    } catch (err) {
      console.error('Error deleting advisor:', err);
    }
  };

  // ========================================
  // MAIN PAGE (no slug)
  // ========================================
  if (!slug) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Junta Directiva</h1>
            <p className="text-sm text-gray-500 mt-1">Tu board de advisors con IA</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => { setEditingAdvisor(null); setShowAdvisorModal(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-[#1A1A2E] text-white text-sm rounded-xl hover:bg-[#2A2A3E] transition-colors"
            >
              <Plus size={16} />
              Nuevo Advisor
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : (
          <>
            {/* Group chat CTA */}
            <button
              onClick={() => navigate('/app/junta-directiva/mesa')}
              className="w-full mb-6 p-6 bg-gradient-to-r from-[#1A1A2E] to-[#2A2A4E] rounded-2xl text-left hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users size={28} className="text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">Mesa de Junta Directiva</h3>
                  <p className="text-sm text-white/60 mt-0.5">
                    Haz una pregunta y todos los advisors opinan, debaten y se complementan
                  </p>
                </div>
                <div className="flex -space-x-2">
                  {advisors.slice(0, 4).map(a => (
                    <div
                      key={a.id}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 border-[#1A1A2E]"
                      style={{ backgroundColor: a.avatar_color }}
                      title={a.name}
                    >
                      {a.icon}
                    </div>
                  ))}
                  {advisors.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs text-white border-2 border-[#1A1A2E]">
                      +{advisors.length - 4}
                    </div>
                  )}
                </div>
              </div>
            </button>

            {/* Individual advisors */}
            <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Conversaciones individuales</h2>
            {advisors.length === 0 ? (
              <div className="text-center py-12">
                <Landmark size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm">No hay advisors configurados</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {advisors.map((advisor) => (
                  <div key={advisor.slug} className="relative group">
                    <button
                      onClick={() => navigate(`/app/junta-directiva/${advisor.slug}`)}
                      className="w-full text-left p-5 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200"
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                          style={{ backgroundColor: `${advisor.avatar_color}15` }}
                        >
                          {advisor.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-800 text-sm">{advisor.name}</h3>
                          <p className="text-xs text-gray-500">{advisor.role}</p>
                        </div>
                      </div>
                      {advisor.expertise && (
                        <p className="text-xs text-gray-400 line-clamp-2">{advisor.expertise}</p>
                      )}
                    </button>
                    {isAdmin && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingAdvisor(advisor); setShowAdvisorModal(true); }}
                          className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500"
                        >
                          <Settings size={12} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteAdvisor(advisor.id); }}
                          className="p-1.5 bg-white border border-gray-200 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {showAdvisorModal && (
          <AdvisorFormModal
            advisor={editingAdvisor}
            onSave={handleAdvisorSaved}
            onClose={() => { setShowAdvisorModal(false); setEditingAdvisor(null); }}
          />
        )}
      </div>
    );
  }

  // ========================================
  // CHAT VIEW (group or direct)
  // ========================================
  const chatTitle = isGroupMode ? 'Mesa de Junta Directiva' : currentAdvisor?.name || 'Chat';
  const chatSubtitle = isGroupMode
    ? `${advisors.length} advisors`
    : currentAdvisor?.role || '';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mx-6 -my-8">
      {/* Sidebar */}
      <div className={`${showSidebar ? 'w-72' : 'w-0'} flex-shrink-0 bg-white border-r transition-all duration-200 overflow-hidden flex flex-col`}>
        <div className="p-3 border-b flex items-center gap-2">
          <button
            onClick={() => navigate('/app/junta-directiva')}
            className="p-1.5 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft size={16} className="text-gray-500" />
          </button>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            {isGroupMode ? (
              <>
                <Users size={18} className="text-gray-600" />
                <p className="text-sm font-semibold text-gray-800 truncate">Mesa Directiva</p>
              </>
            ) : currentAdvisor && (
              <>
                <span className="text-lg">{currentAdvisor.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{currentAdvisor.name}</p>
                  <p className="text-xs text-gray-400 truncate">{currentAdvisor.role}</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="p-2">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Plus size={16} />
            Nueva conversación
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => loadConversation(conv.id)}
              className={`w-full text-left px-3 py-2.5 mx-2 mb-0.5 rounded-lg transition-colors group flex items-center gap-2 ${
                activeConversationId === conv.id ? 'bg-gray-100 text-gray-800' : 'text-gray-600 hover:bg-gray-50'
              }`}
              style={{ maxWidth: 'calc(100% - 16px)' }}
            >
              <MessageSquare size={14} className="flex-shrink-0 text-gray-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{conv.title || 'Nueva conversación'}</p>
                {conv.last_message && (
                  <p className="text-xs text-gray-400 truncate mt-0.5">{conv.last_message.substring(0, 50)}</p>
                )}
              </div>
              <button
                onClick={(e) => handleDeleteConversation(conv.id, e)}
                className="p-1 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
              >
                <Trash2 size={12} />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-4 py-2.5 bg-white border-b flex items-center gap-3">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1.5 hover:bg-gray-100 rounded-lg lg:hidden"
          >
            <ChevronLeft size={18} className={`text-gray-500 transition-transform ${!showSidebar ? 'rotate-180' : ''}`} />
          </button>

          {isGroupMode ? (
            <div className="flex items-center gap-2 flex-1">
              <div className="w-8 h-8 rounded-lg bg-[#1A1A2E] flex items-center justify-center">
                <Users size={16} className="text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">{chatTitle}</h2>
                <div className="flex items-center gap-1">
                  {advisors.slice(0, 3).map(a => (
                    <span key={a.id} className="text-xs" title={a.name}>{a.icon}</span>
                  ))}
                  <span className="text-xs text-gray-400">{chatSubtitle}</span>
                </div>
              </div>
            </div>
          ) : currentAdvisor && (
            <>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                style={{ backgroundColor: `${currentAdvisor.avatar_color}15` }}
              >
                {currentAdvisor.icon}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-gray-800">{chatTitle}</h2>
                <p className="text-xs text-gray-400 truncate">{chatSubtitle}</p>
              </div>
            </>
          )}

          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Nuevo</span>
            </button>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {loadingConversation ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-lg px-6">
                {isGroupMode ? (
                  <>
                    <div className="w-16 h-16 rounded-2xl bg-[#1A1A2E] flex items-center justify-center mx-auto mb-4">
                      <Users size={32} className="text-white" />
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Mesa de Junta Directiva</h2>
                    <p className="text-sm text-gray-500 mb-6">
                      Haz una pregunta y todos tus advisors darán su opinión. Pueden debatir y complementarse entre ellos.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2 mb-6">
                      {advisors.map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-xs text-gray-600">
                          <span>{a.icon}</span>
                          <span>{a.name}</span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {[
                        '¿Deberíamos subir los precios de nuestros servicios?',
                        '¿Cómo podemos escalar la agencia sin contratar más personas?',
                        '¿Cuál debería ser nuestra estrategia de contenido para los próximos 3 meses?',
                      ].map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => { setInputValue(prompt); inputRef.current?.focus(); }}
                          className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm text-gray-600 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : currentAdvisor && (
                  <>
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                      style={{ backgroundColor: `${currentAdvisor.avatar_color}15` }}
                    >
                      {currentAdvisor.icon}
                    </div>
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">{currentAdvisor.name}</h2>
                    <p className="text-sm text-gray-500 mb-1">{currentAdvisor.role}</p>
                    {currentAdvisor.expertise && (
                      <p className="text-xs text-gray-400 mb-6">{currentAdvisor.expertise}</p>
                    )}
                    {(currentAdvisor.example_prompts || []).length > 0 && (
                      <div className="space-y-2">
                        {currentAdvisor.example_prompts.map((prompt, i) => (
                          <button
                            key={i}
                            onClick={() => { setInputValue(prompt); inputRef.current?.focus(); }}
                            className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm text-gray-600 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                  {msg.role === 'assistant' && (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-1"
                      style={{ backgroundColor: `${msg.advisor_color || '#6366f1'}15` }}
                    >
                      {msg.advisor_icon || '🧠'}
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] ${
                      msg.role === 'user'
                        ? 'bg-[#1A1A2E] text-white rounded-2xl rounded-br-md px-4 py-3'
                        : 'flex-1 min-w-0'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <>
                        {/* Advisor name tag for group chats or when advisor info is present */}
                        {msg.advisor_name && (
                          <p className="text-xs font-semibold mb-1" style={{ color: msg.advisor_color || '#6366f1' }}>
                            {msg.advisor_name}
                          </p>
                        )}
                        <div className={`prose prose-sm max-w-none ${msg.error ? 'text-red-500' : 'text-gray-700'}`}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content || ' '}
                          </ReactMarkdown>
                          {msg.streaming && (
                            <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded-sm ml-0.5" />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-6 py-3 bg-white border-t">
          {streaming && currentStreamingAdvisor && (
            <div className="max-w-3xl mx-auto mb-2 flex items-center gap-2 text-xs text-gray-400">
              <Loader2 size={12} className="animate-spin" />
              <span>{currentStreamingAdvisor.advisor_name} está respondiendo...</span>
            </div>
          )}
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isGroupMode ? 'Pregúntale a la junta directiva...' : `Pregúntale a ${currentAdvisor?.name || 'el advisor'}...`}
              rows={1}
              disabled={streaming}
              className="flex-1 resize-none px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 max-h-32 disabled:opacity-50"
              style={{ minHeight: '40px' }}
            />
            {streaming ? (
              <button onClick={handleStop} className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors">
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="p-2.5 bg-[#1A1A2E] text-white rounded-xl hover:bg-[#2A2A3E] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showAdvisorModal && (
        <AdvisorFormModal
          advisor={editingAdvisor}
          onSave={handleAdvisorSaved}
          onClose={() => { setShowAdvisorModal(false); setEditingAdvisor(null); }}
        />
      )}
    </div>
  );
};

export default BoardAdvisors;
