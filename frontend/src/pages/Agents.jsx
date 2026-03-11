import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bot, Send, ArrowLeft, Loader2, Sparkles, RotateCcw, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { agentsAPI } from '../utils/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Agents = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // Load agents list
  useEffect(() => {
    const load = async () => {
      try {
        const res = await agentsAPI.list();
        setAgents(res.data);
      } catch (err) {
        console.error('Error loading agents:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Focus input when agent selected
  useEffect(() => {
    if (slug) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [slug]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const currentAgent = agents.find((a) => a.slug === slug);

  const handleSend = async () => {
    if (!inputValue.trim() || streaming || !slug) return;

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    scrollToBottom();

    // Start streaming
    setStreaming(true);
    setMessages((prev) => [...prev, { role: 'assistant', content: '', streaming: true }]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/agents/${slug}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({ message: userMessage, sessionId }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

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

            if (data.type === 'text') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant' && last.streaming) {
                  updated[updated.length - 1] = { ...last, content: last.content + data.text };
                }
                return updated;
              });
              scrollToBottom();
            }

            if (data.type === 'done') {
              if (data.sessionId) setSessionId(data.sessionId);
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    streaming: false,
                    cost: data.cost,
                    usage: data.usage,
                  };
                }
                return updated;
              });
            }

            if (data.type === 'error') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: `Error: ${data.error}`,
                    streaming: false,
                    error: true,
                  };
                }
                return updated;
              });
            }
          } catch {
            // skip malformed JSON
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant' && last.streaming) {
            updated[updated.length - 1] = { ...last, streaming: false, content: last.content || '(Cancelado)' };
          }
          return updated;
        });
      } else {
        console.error('Stream error:', err);
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: `Error de conexión: ${err.message}`,
              streaming: false,
              error: true,
            };
          }
          return updated;
        });
      }
    } finally {
      setStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    abortControllerRef.current?.abort();
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Agent selection grid
  if (!slug) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800">Agentes IA</h1>
          <p className="text-sm text-gray-500 mt-1">
            Asistentes inteligentes especializados para tu negocio
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={24} />
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <Bot size={48} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 text-sm">No hay agentes disponibles</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <button
                key={agent.slug}
                onClick={() => navigate(`/app/agents/${agent.slug}`)}
                className="group text-left p-6 bg-white rounded-2xl border border-gray-100 hover:border-gray-200 hover:shadow-md transition-all duration-200"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4"
                  style={{ backgroundColor: `${agent.color}15` }}
                >
                  {agent.icon}
                </div>
                <h3 className="font-semibold text-gray-800 group-hover:text-[#1A1A2E] transition-colors">
                  {agent.name}
                </h3>
                <p className="text-sm text-gray-500 mt-1 line-clamp-2">{agent.description}</p>
                <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400 group-hover:text-[#1A1A2E] transition-colors">
                  <Sparkles size={14} />
                  <span>Iniciar conversación</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Agent chat interface
  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] -mx-6 -my-8">
      {/* Header */}
      <div className="px-6 py-3 bg-white border-b flex items-center gap-3">
        <button
          onClick={() => navigate('/app/agents')}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-gray-500" />
        </button>

        {currentAgent && (
          <>
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
              style={{ backgroundColor: `${currentAgent.color}15` }}
            >
              {currentAgent.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-gray-800">{currentAgent.name}</h2>
              <p className="text-xs text-gray-400 truncate">{currentAgent.description}</p>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              title="Nueva conversación"
            >
              <RotateCcw size={14} />
              <span className="hidden sm:inline">Nuevo chat</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-md px-6">
              {currentAgent && (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4"
                    style={{ backgroundColor: `${currentAgent.color}15` }}
                  >
                    {currentAgent.icon}
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-2">{currentAgent.name}</h2>
                  <p className="text-sm text-gray-500 mb-6">{currentAgent.description}</p>
                </>
              )}
              <div className="space-y-2">
                {getExamplePrompts(slug).map((prompt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInputValue(prompt);
                      inputRef.current?.focus();
                    }}
                    className="w-full text-left px-4 py-3 bg-white border border-gray-100 rounded-xl text-sm text-gray-600 hover:border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0 mt-1"
                    style={{ backgroundColor: `${currentAgent?.color || '#8b5cf6'}15` }}
                  >
                    {currentAgent?.icon || '🤖'}
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
                    <div className={`prose prose-sm max-w-none ${msg.error ? 'text-red-500' : 'text-gray-700'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || ' '}
                      </ReactMarkdown>
                      {msg.streaming && (
                        <span className="inline-block w-2 h-4 bg-gray-400 animate-pulse rounded-sm ml-0.5" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="px-6 py-3 bg-white border-t">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={currentAgent ? `Pregúntale a ${currentAgent.name}...` : 'Escribe tu mensaje...'}
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/20 max-h-32 disabled:opacity-50"
            style={{ minHeight: '40px' }}
          />
          {streaming ? (
            <button
              onClick={handleStop}
              className="p-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
              title="Detener"
            >
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
  );
};

// Example prompts per agent
function getExamplePrompts(slug) {
  const prompts = {
    'marca-personal': [
      'Soy dentista y quiero construir mi marca personal en redes',
      'Dame ideas de contenido TOFU para una agencia de marketing',
      'Ayúdame a definir mis 3 calentamientos para Instagram',
      'Cómo organizo mi embudo de contenido si vendo cursos online?',
    ],
  };
  return prompts[slug] || [
    'Hola, ¿en qué me puedes ayudar?',
    '¿Cuál es tu especialidad?',
  ];
}

export default Agents;
