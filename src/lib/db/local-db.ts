import Dexie, { type Table } from 'dexie';

export interface LocalRoom {
  id: string;
  name: string;
  avatar_emoji: string;
  type: 'direct' | 'group';
  last_message: string;
  last_message_at: string | null;
  last_opened_at: number; // For LRU eviction tracking
  unread_count: number;
  is_muted: number;
}

export interface MediaMetadata {
  width?: number;
  height?: number;
  aspect_ratio?: number;
  blurhash?: string;
  thumbnail?: string;
  upload_state?: 'pending' | 'success' | 'failed';
  access_count?: number; // For hot media promotion tracking
}

export interface LocalMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_nickname: string;
  sender_avatar: string;
  content: string;
  type: 'text' | 'image' | 'system';
  media_url?: string; // Removed when pruned, leaving metadata intact
  created_at: string;
  delivery_status: 'sending' | 'sent' | 'failed';
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_sender_nickname?: string;
  is_forwarded?: boolean;
  has_media: number; // 0 or 1
  media_metadata?: MediaMetadata;
  reactions?: { [emoji: string]: string[] }; // Store nested reactions map in local IndexedDB document
}

export class VeiloLocalDB extends Dexie {
  rooms!: Table<LocalRoom, string>;
  messages!: Table<LocalMessage, string>;

  constructor() {
    super('VeiloLocalDB');
    this.version(9999).stores({
      rooms: 'id, last_message_at, last_opened_at',
      messages: 'id, room_id, created_at, type, has_media, [room_id+created_at]'
    });
  }
}

const globalForDB = globalThis as unknown as { localDB: VeiloLocalDB };

export const localDB = globalForDB.localDB || new VeiloLocalDB();

if (process.env.NODE_ENV !== 'production') {
  globalForDB.localDB = localDB;
}

if (typeof window !== 'undefined') {
  localDB.on('blocked', () => {
    console.warn('VeiloLocalDB database upgrade is blocked by another tab/session. Closing connection.');
    localDB.close();
  });

  localDB.on('versionchange', () => {
    console.log('VeiloLocalDB database version changed elsewhere. Reloading...');
    localDB.close();
    window.location.reload();
  });
}
