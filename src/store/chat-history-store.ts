import { create } from 'zustand';
import { type Message } from '@/hooks/use-chat';
import { localDB } from '@/lib/db/local-db';
import Dexie from 'dexie';

interface ChatHistoryState {
  hotCache: Record<string, Message[]>;
  coldHistory: Record<string, Message[]>;
  accessedRooms: string[]; // Tracks room access order for LRU memory eviction
  
  setHotMessages: (roomId: string, messages: Message[]) => void;
  appendColdHistory: (roomId: string, messages: Message[]) => void;
  clearColdHistory: (roomId: string) => void;
  getCombinedMessages: (roomId: string) => Message[];
  
  recordAccess: (roomId: string) => void;
  pruneCache: (activeRoomId?: string) => void;
  prewarmRooms: () => Promise<void>;
  prewarmRoom: (roomId: string) => Promise<void>;
  
  // Hot Media Promotion Tracker
  incrementMediaAccess: (roomId: string, messageId: string, currentMediaUrl: string) => Promise<void>;
}

const inFlightPrewarms = new Set<string>();

export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  hotCache: {},
  coldHistory: {},
  accessedRooms: [],

  setHotMessages: (roomId, messages) =>
    set((state) => ({
      hotCache: { ...state.hotCache, [roomId]: messages }
    })),

  appendColdHistory: (roomId, messages) =>
    set((state) => {
      const existing = state.coldHistory[roomId] || [];
      return {
        coldHistory: {
          ...state.coldHistory,
          [roomId]: [...existing, ...messages]
        }
      };
    }),

  clearColdHistory: (roomId) =>
    set((state) => {
      const nextCold = { ...state.coldHistory };
      delete nextCold[roomId];
      return { coldHistory: nextCold };
    }),

  getCombinedMessages: (roomId) => {
    const hot = get().hotCache[roomId] || [];
    const cold = get().coldHistory[roomId] || [];
    return [...hot, ...cold];
  },

  recordAccess: (roomId) => {
    set((state) => {
      // Remove room if it already exists, then append it to the end (most recently used)
      const nextAccessed = state.accessedRooms.filter((id) => id !== roomId);
      nextAccessed.push(roomId);
      return { accessedRooms: nextAccessed };
    });
    
    // Automatically prune if we exceed the threshold
    get().pruneCache();
  },

  pruneCache: (activeRoomId) => {
    const state = get();
    let accessed = [...state.accessedRooms];
    
    // Memory Pressure Guard: check browser JS heap size
    let isMemoryUnderPressure = false;
    if (typeof window !== 'undefined' && (performance as any).memory) {
      const mem = (performance as any).memory;
      const heapUsage = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
      if (heapUsage > 0.75) {
        isMemoryUnderPressure = true;
        console.warn('Veilo Store: High heap size detected. Evicting inactive room caches.');
      }
    }

    const maxKeep = isMemoryUnderPressure ? 1 : 5;

    let remaining = [...accessed];
    let toEvict: string[] = [];

    if (accessed.length > maxKeep) {
      toEvict = accessed.slice(0, accessed.length - maxKeep);
      remaining = accessed.slice(accessed.length - maxKeep);
    }

    set((state) => {
      const nextHot = { ...state.hotCache };
      const nextCold = { ...state.coldHistory };

      // 1. Evict oldest accessed rooms
      toEvict.forEach((roomId) => {
        if (roomId === activeRoomId) {
          if (!remaining.includes(roomId)) {
            remaining.push(roomId);
          }
          return;
        }
        delete nextHot[roomId];
        delete nextCold[roomId];
      });

      // 2. Sweep/Garbage-collect any rooms in hotCache/coldHistory that are NOT in remaining
      // This protects against abandoned prewarms leaking memory!
      const keepSet = new Set(remaining);
      if (activeRoomId) {
        keepSet.add(activeRoomId);
      }

      Object.keys(nextHot).forEach((roomId) => {
        if (!keepSet.has(roomId)) {
          delete nextHot[roomId];
        }
      });

      Object.keys(nextCold).forEach((roomId) => {
        if (!keepSet.has(roomId)) {
          delete nextCold[roomId];
        }
      });

      return {
        hotCache: nextHot,
        coldHistory: nextCold,
        accessedRooms: remaining
      };
    });
  },

  prewarmRooms: async () => {
    try {
      // 1. Fetch top 3 recently opened rooms from IndexedDB
      const rooms = await localDB.rooms
        .orderBy('last_opened_at')
        .reverse()
        .limit(3)
        .toArray();

      if (rooms.length === 0) return;

      // 2. Preload messages for each room into Zustand hotCache
      for (const room of rooms) {
        const localMessages = await localDB.messages
          .where('[room_id+created_at]')
          .between([room.id, Dexie.minKey], [room.id, Dexie.maxKey])
          .reverse()
          .limit(30)
          .toArray();

        // Standard format timestamp utility
        const formatted = localMessages.map((msg) => {
          let time = '';
          try {
            time = new Date(msg.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            });
          } catch {}
          return {
            ...msg,
            formatted_time: msg.formatted_time || time
          };
        });

        set((state) => ({
          hotCache: { ...state.hotCache, [room.id]: formatted }
        }));
      }
    } catch (err) {
      console.error('Failed to prewarm rooms:', err);
    }
  },

  prewarmRoom: async (roomId) => {
    if (get().hotCache[roomId] && get().hotCache[roomId].length > 0) return;
    if (inFlightPrewarms.has(roomId)) return;

    inFlightPrewarms.add(roomId);
    try {
      const localMessages = await localDB.messages
        .where('[room_id+created_at]')
        .between([roomId, Dexie.minKey], [roomId, Dexie.maxKey])
        .reverse()
        .limit(30)
        .toArray();

      const formatted = localMessages.map((msg) => {
        let time = '';
        try {
          time = new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });
        } catch {}
        return {
          ...msg,
          formatted_time: msg.formatted_time || time
        };
      });

      set((state) => ({
        hotCache: { ...state.hotCache, [roomId]: formatted }
      }));
      console.log(`Prewarmed hotCache for room: ${roomId} with ${formatted.length} messages`);
    } catch (err) {
      console.error(`Failed to prewarm room ${roomId}:`, err);
    } finally {
      inFlightPrewarms.delete(roomId);
    }
  },

  incrementMediaAccess: async (roomId, messageId, currentMediaUrl) => {
    try {
      const msg = await localDB.messages.get(messageId);
      if (!msg || msg.type !== 'image') return;

      const currentMetadata = msg.media_metadata || {};
      const nextCount = (currentMetadata.access_count || 0) + 1;

      // Update local db with new access count
      await localDB.messages.update(messageId, {
        media_metadata: {
          ...currentMetadata,
          access_count: nextCount
        }
      });

      // Hot Media Promotion: If accessed repeatedly (e.g. >= 3 times), promote it by ensuring media_url is saved
      if (nextCount >= 3 && !msg.media_url && currentMediaUrl) {
        await localDB.messages.update(messageId, {
          media_url: currentMediaUrl,
          has_media: 1
        });
      }
    } catch (err) {
      console.error('Failed to increment media access count:', err);
    }
  }
}));
