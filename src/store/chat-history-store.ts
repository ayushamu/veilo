import { create } from 'zustand';
import { type Message } from '@/hooks/use-chat';
import { localDB } from '@/lib/db/local-db';

interface ChatHistoryState {
  hotCache: Record<string, Message[]>;
  coldHistory: Record<string, Message[]>;
  
  setHotMessages: (roomId: string, messages: Message[]) => void;
  appendColdHistory: (roomId: string, messages: Message[]) => void;
  clearColdHistory: (roomId: string) => void;
  getCombinedMessages: (roomId: string) => Message[];
  
  // Hot Media Promotion Tracker
  incrementMediaAccess: (roomId: string, messageId: string, currentMediaUrl: string) => Promise<void>;
}

export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  hotCache: {},
  coldHistory: {},

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
