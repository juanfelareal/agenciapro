import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

const messageSync = 0;
const messageAwareness = 1;

// WebSocket URL - defaults to same host with /collaboration namespace
const getWsUrl = () => {
  const wsUrl = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL;
  if (wsUrl) {
    return wsUrl.replace(/^http/, 'ws').replace(/\/api$/, '');
  }
  // Fallback to current origin
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
};

export const useCollaboration = (noteId, user) => {
  const [connected, setConnected] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [collaboratorCount, setCollaboratorCount] = useState(0);
  const [synced, setSynced] = useState(false);

  const socketRef = useRef(null);
  const docRef = useRef(null);
  const awarenessRef = useRef(null);
  const providerRef = useRef(null);

  // Get or create Yjs document
  const getDoc = useCallback(() => {
    if (!docRef.current) {
      docRef.current = new Y.Doc();
    }
    return docRef.current;
  }, []);

  // Get or create awareness
  const getAwareness = useCallback(() => {
    if (!awarenessRef.current && docRef.current) {
      awarenessRef.current = new awarenessProtocol.Awareness(docRef.current);
    }
    return awarenessRef.current;
  }, []);

  // Connect to collaboration server
  useEffect(() => {
    if (!noteId) return;

    const doc = getDoc();
    const awareness = getAwareness();

    // Create socket connection
    const baseUrl = getWsUrl();
    const socket = io(`${baseUrl}/collaboration`, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    // Handle connection
    socket.on('connect', () => {
      console.log('[Collab] Connected to server');
      setConnected(true);

      // Join the note room
      socket.emit('join-note', {
        noteId,
        user: {
          name: user?.name || 'Anonymous',
          color: user?.color || getRandomColor(),
        }
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('[Collab] Disconnected from server');
      setConnected(false);
      setSynced(false);
    });

    // Handle joined confirmation
    socket.on('joined', ({ collaborators: count }) => {
      console.log(`[Collab] Joined note ${noteId} with ${count} users`);
      setCollaboratorCount(count);
    });

    // Handle sync messages
    socket.on('sync', (message) => {
      try {
        const decoder = decoding.createDecoder(new Uint8Array(message));
        const messageType = decoding.readVarUint(decoder);

        if (messageType === messageSync) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageSync);
          const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);

          if (encoding.length(encoder) > 1) {
            socket.emit('sync', encoding.toUint8Array(encoder));
          }

          // Mark as synced after receiving sync step 2
          if (syncMessageType === syncProtocol.messageYjsSyncStep2) {
            setSynced(true);
          }
        }
      } catch (error) {
        console.error('[Collab] Sync error:', error);
      }
    });

    // Handle awareness updates
    socket.on('awareness', (message) => {
      try {
        const decoder = decoding.createDecoder(new Uint8Array(message));
        const messageType = decoding.readVarUint(decoder);

        if (messageType === messageAwareness && awareness) {
          awarenessProtocol.applyAwarenessUpdate(
            awareness,
            decoding.readVarUint8Array(decoder),
            socket
          );
        }
      } catch (error) {
        console.error('[Collab] Awareness error:', error);
      }
    });

    // Handle user events
    socket.on('user-joined', ({ user, collaborators: count }) => {
      console.log(`[Collab] User joined: ${user?.name}`);
      setCollaboratorCount(count);
    });

    socket.on('user-left', ({ collaborators: count }) => {
      console.log('[Collab] User left');
      setCollaboratorCount(count);
    });

    // Listen to local document changes
    const handleUpdate = (update, origin) => {
      if (origin !== 'remote' && socket.connected) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        socket.emit('sync', encoding.toUint8Array(encoder));
      }
    };
    doc.on('update', handleUpdate);

    // Listen to awareness changes
    if (awareness) {
      const handleAwarenessUpdate = ({ added, updated, removed }) => {
        const changedClients = added.concat(updated).concat(removed);
        if (socket.connected) {
          const encoder = encoding.createEncoder();
          encoding.writeVarUint(encoder, messageAwareness);
          encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
          );
          socket.emit('awareness', encoding.toUint8Array(encoder));
        }

        // Update collaborators list
        const states = awareness.getStates();
        const users = [];
        states.forEach((state, clientId) => {
          if (state.user && clientId !== awareness.clientID) {
            users.push({
              clientId,
              ...state.user
            });
          }
        });
        setCollaborators(users);
      };
      awareness.on('update', handleAwarenessUpdate);

      // Set local user awareness
      awareness.setLocalStateField('user', {
        name: user?.name || 'Anonymous',
        color: user?.color || getRandomColor(),
      });
    }

    // Create provider object for TipTap
    providerRef.current = {
      doc,
      awareness,
      connected: true,
      synced: false,
      on: (event, callback) => {
        if (event === 'sync') {
          // Handle sync event
          doc.on('update', callback);
        }
      },
      off: (event, callback) => {
        if (event === 'sync') {
          doc.off('update', callback);
        }
      },
      destroy: () => {
        socket.disconnect();
      }
    };

    // Cleanup
    return () => {
      socket.emit('leave-note');
      socket.disconnect();
      doc.off('update', handleUpdate);
      if (awareness) {
        awareness.destroy();
      }
      docRef.current = null;
      awarenessRef.current = null;
      providerRef.current = null;
      setConnected(false);
      setSynced(false);
      setCollaborators([]);
    };
  }, [noteId, user?.name, user?.color, getDoc, getAwareness]);

  return {
    doc: docRef.current,
    awareness: awarenessRef.current,
    provider: providerRef.current,
    connected,
    synced,
    collaborators,
    collaboratorCount,
  };
};

// Generate random color for user cursor
const getRandomColor = () => {
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
  return colors[Math.floor(Math.random() * colors.length)];
};

export default useCollaboration;
