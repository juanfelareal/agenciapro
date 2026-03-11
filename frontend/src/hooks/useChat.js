import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const getWsUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL;
  if (wsUrl) {
    return wsUrl.replace(/^http/, 'ws').replace(/\/api$/, '');
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const useChat = (user) => {
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const socketRef = useRef(null);
  const listenersRef = useRef({});

  useEffect(() => {
    if (!user?.id) return;

    const baseUrl = getWsUrl();
    const socket = io(`${baseUrl}/chat`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      const token = localStorage.getItem('token');
      socket.emit('authenticate', { token, teamMemberId: user.id });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('authenticated', (data) => {
      console.log('[Chat] Authenticated:', data.name);
    });

    socket.on('online-users', (memberIds) => {
      setOnlineUsers(memberIds);
    });

    socket.on('user-online', ({ teamMemberId }) => {
      setOnlineUsers((prev) => [...new Set([...prev, teamMemberId])]);
    });

    socket.on('user-offline', ({ teamMemberId }) => {
      setOnlineUsers((prev) => prev.filter((id) => id !== teamMemberId));
    });

    socket.on('user-typing', ({ teamMemberId, name, conversationId }) => {
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: { ...(prev[conversationId] || {}), [teamMemberId]: name },
      }));
    });

    socket.on('user-stop-typing', ({ teamMemberId, conversationId }) => {
      setTypingUsers((prev) => {
        const convTyping = { ...(prev[conversationId] || {}) };
        delete convTyping[teamMemberId];
        return { ...prev, [conversationId]: convTyping };
      });
    });

    // Forward events to registered listeners
    socket.on('new-message', (msg) => {
      listenersRef.current.onNewMessage?.(msg);
    });

    socket.on('message-sent', (msg) => {
      listenersRef.current.onMessageSent?.(msg);
    });

    socket.on('read-receipt', (data) => {
      listenersRef.current.onReadReceipt?.(data);
    });

    socket.on('error', (err) => {
      console.error('[Chat] Socket error:', err.message);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setOnlineUsers([]);
      setTypingUsers({});
    };
  }, [user?.id]);

  const sendMessage = useCallback(({ conversationId, content, entityMentions }) => {
    socketRef.current?.emit('send-message', { conversationId, content, entityMentions });
  }, []);

  const markRead = useCallback((conversationId) => {
    socketRef.current?.emit('mark-read', { conversationId });
  }, []);

  const startTyping = useCallback((conversationId) => {
    socketRef.current?.emit('typing', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId) => {
    socketRef.current?.emit('stop-typing', { conversationId });
  }, []);

  const onNewMessage = useCallback((fn) => {
    listenersRef.current.onNewMessage = fn;
  }, []);

  const onMessageSent = useCallback((fn) => {
    listenersRef.current.onMessageSent = fn;
  }, []);

  const onReadReceipt = useCallback((fn) => {
    listenersRef.current.onReadReceipt = fn;
  }, []);

  return {
    connected,
    onlineUsers,
    typingUsers,
    sendMessage,
    markRead,
    startTyping,
    stopTyping,
    onNewMessage,
    onMessageSent,
    onReadReceipt,
  };
};

export default useChat;
