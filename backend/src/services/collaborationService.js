import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import db from '../config/database.js';

// Store active documents and awareness states
const docs = new Map(); // noteId -> Y.Doc
const awareness = new Map(); // noteId -> Awareness
const rooms = new Map(); // noteId -> Set of socket ids

// Message types for WebSocket protocol
const messageSync = 0;
const messageAwareness = 1;

// Debounce function for persistence
const debounce = (fn, delay) => {
  let timer = null;
  return (...args) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

// Get or create a Yjs document for a note
const getDoc = async (noteId) => {
  if (docs.has(noteId)) {
    return docs.get(noteId);
  }

  const doc = new Y.Doc();
  docs.set(noteId, doc);

  // Load existing state from database
  try {
    const note = await db.get('SELECT yjs_state, content FROM notes WHERE id = ?', [noteId]);
    if (note?.yjs_state) {
      // Apply stored Yjs state
      const state = Buffer.from(note.yjs_state, 'base64');
      Y.applyUpdate(doc, new Uint8Array(state));
      console.log(`[Collab] Loaded Yjs state for note ${noteId}`);
    } else if (note?.content) {
      // Migrate existing content to Yjs format
      try {
        const tiptapContent = JSON.parse(note.content);
        const yXmlFragment = doc.getXmlFragment('prosemirror');
        // Initialize with empty state - TipTap will handle content sync
        console.log(`[Collab] Initialized new Yjs doc for note ${noteId}`);
      } catch (e) {
        console.log(`[Collab] Note ${noteId} has non-JSON content, starting fresh`);
      }
    }
  } catch (error) {
    console.error(`[Collab] Error loading note ${noteId}:`, error.message);
  }

  return doc;
};

// Get or create awareness for a note
const getAwareness = (noteId) => {
  if (awareness.has(noteId)) {
    return awareness.get(noteId);
  }

  const doc = docs.get(noteId);
  if (!doc) return null;

  const awr = new awarenessProtocol.Awareness(doc);
  awareness.set(noteId, awr);
  return awr;
};

// Persist Yjs state to database
const persistDoc = debounce(async (noteId) => {
  const doc = docs.get(noteId);
  if (!doc) return;

  try {
    const state = Y.encodeStateAsUpdate(doc);
    const stateBase64 = Buffer.from(state).toString('base64');

    await db.run(
      'UPDATE notes SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [stateBase64, noteId]
    );
    console.log(`[Collab] Persisted state for note ${noteId}`);
  } catch (error) {
    console.error(`[Collab] Error persisting note ${noteId}:`, error.message);
  }
}, 3000); // Persist every 3 seconds of inactivity

// Clean up when no users are in a room
const cleanupRoom = async (noteId) => {
  const room = rooms.get(noteId);
  if (room && room.size === 0) {
    // Persist before cleanup
    const doc = docs.get(noteId);
    if (doc) {
      const state = Y.encodeStateAsUpdate(doc);
      const stateBase64 = Buffer.from(state).toString('base64');
      try {
        await db.run(
          'UPDATE notes SET yjs_state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [stateBase64, noteId]
        );
        console.log(`[Collab] Final persist for note ${noteId}`);
      } catch (error) {
        console.error(`[Collab] Error final persisting note ${noteId}:`, error.message);
      }
    }

    // Clean up memory
    docs.delete(noteId);
    awareness.delete(noteId);
    rooms.delete(noteId);
    console.log(`[Collab] Cleaned up room for note ${noteId}`);
  }
};

// Setup Socket.io collaboration handlers
export const setupCollaboration = (io) => {
  const collabNamespace = io.of('/collaboration');

  collabNamespace.on('connection', (socket) => {
    console.log(`[Collab] Client connected: ${socket.id}`);

    let currentRoom = null;
    let currentNoteId = null;

    // Join a note room
    socket.on('join-note', async ({ noteId, user }) => {
      if (!noteId) {
        socket.emit('error', { message: 'Note ID required' });
        return;
      }

      // Leave previous room if any
      if (currentRoom) {
        socket.leave(currentRoom);
        const oldRoom = rooms.get(currentNoteId);
        if (oldRoom) {
          oldRoom.delete(socket.id);
          cleanupRoom(currentNoteId);
        }
      }

      currentNoteId = noteId;
      currentRoom = `note:${noteId}`;
      socket.join(currentRoom);

      // Track room membership
      if (!rooms.has(noteId)) {
        rooms.set(noteId, new Set());
      }
      rooms.get(noteId).add(socket.id);

      // Get or create Yjs document
      const doc = await getDoc(noteId);
      const awr = getAwareness(noteId);

      // Set user awareness
      if (awr && user) {
        awr.setLocalStateField('user', {
          id: socket.id,
          name: user.name || 'Anonymous',
          color: user.color || getRandomColor(),
        });
      }

      // Send initial sync
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, messageSync);
      syncProtocol.writeSyncStep1(encoder, doc);
      socket.emit('sync', encoding.toUint8Array(encoder));

      // Send current awareness state
      if (awr) {
        const awarenessEncoder = encoding.createEncoder();
        encoding.writeVarUint(awarenessEncoder, messageAwareness);
        encoding.writeVarUint8Array(
          awarenessEncoder,
          awarenessProtocol.encodeAwarenessUpdate(awr, Array.from(awr.getStates().keys()))
        );
        socket.emit('awareness', encoding.toUint8Array(awarenessEncoder));
      }

      // Get collaborators count
      const collaborators = rooms.get(noteId)?.size || 0;
      socket.emit('joined', { noteId, collaborators });
      socket.to(currentRoom).emit('user-joined', {
        socketId: socket.id,
        user: user || { name: 'Anonymous' },
        collaborators
      });

      console.log(`[Collab] ${socket.id} joined note ${noteId} (${collaborators} users)`);
    });

    // Handle sync messages
    socket.on('sync', async (message) => {
      if (!currentNoteId) return;

      const doc = docs.get(currentNoteId);
      if (!doc) return;

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

          // Broadcast to other users in the room
          if (syncMessageType === syncProtocol.messageYjsSyncStep2 ||
              syncMessageType === syncProtocol.messageYjsUpdate) {
            socket.to(currentRoom).emit('sync', message);
            persistDoc(currentNoteId);
          }
        }
      } catch (error) {
        console.error(`[Collab] Sync error:`, error.message);
      }
    });

    // Handle awareness updates
    socket.on('awareness', (message) => {
      if (!currentNoteId) return;

      const awr = awareness.get(currentNoteId);
      if (!awr) return;

      try {
        const decoder = decoding.createDecoder(new Uint8Array(message));
        const messageType = decoding.readVarUint(decoder);

        if (messageType === messageAwareness) {
          awarenessProtocol.applyAwarenessUpdate(
            awr,
            decoding.readVarUint8Array(decoder),
            socket
          );
          // Broadcast to other users
          socket.to(currentRoom).emit('awareness', message);
        }
      } catch (error) {
        console.error(`[Collab] Awareness error:`, error.message);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`[Collab] Client disconnected: ${socket.id}`);

      if (currentNoteId) {
        const room = rooms.get(currentNoteId);
        if (room) {
          room.delete(socket.id);

          // Remove from awareness
          const awr = awareness.get(currentNoteId);
          if (awr) {
            awarenessProtocol.removeAwarenessStates(awr, [socket.id], null);
          }

          // Notify remaining users
          const collaborators = room.size;
          socket.to(currentRoom).emit('user-left', {
            socketId: socket.id,
            collaborators
          });

          // Cleanup if empty
          cleanupRoom(currentNoteId);
        }
      }
    });

    // Handle leave room explicitly
    socket.on('leave-note', () => {
      if (currentRoom && currentNoteId) {
        socket.leave(currentRoom);
        const room = rooms.get(currentNoteId);
        if (room) {
          room.delete(socket.id);
          socket.to(currentRoom).emit('user-left', {
            socketId: socket.id,
            collaborators: room.size
          });
          cleanupRoom(currentNoteId);
        }
        currentRoom = null;
        currentNoteId = null;
      }
    });
  });

  console.log('✅ Collaboration WebSocket service initialized');
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

export default { setupCollaboration };
