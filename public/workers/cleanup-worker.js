// public/workers/cleanup-worker.js
// Dexie is imported inside workers using importScripts or direct integration if bundled.
// In raw Web Worker, we open IndexedDB directly to avoid script resolving errors in non-bundled contexts.
// This ensures perfect compatibility with Next.js static files.

const DB_NAME = 'VeiloLocalDB';
const DB_VERSION = 9999;
const BATCH_SIZE = 40;
const BATCH_DELAY_MS = 50;

let isPaused = false;
let pendingTask = null;

// Opens IndexedDB native handle safely
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = (e) => {
      const db = e.target.result;
      db.onversionchange = () => {
        db.close();
      };
      resolve(db);
    };
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Yields execution if paused by touch/scroll event
async function checkPause() {
  while (isPaused) {
    await sleep(100);
  }
}

self.onmessage = async (event) => {
  const { action, adaptiveThresholds } = event.data;

  if (action === 'PAUSE') {
    isPaused = true;
    return;
  }

  if (action === 'RESUME') {
    isPaused = false;
    return;
  }

  if (action === 'RUN_CLEANUP') {
    try {
      const db = await openDatabase();
      await runCleanupSequence(db, adaptiveThresholds);
      self.postMessage({ success: true });
    } catch (err) {
      self.postMessage({ success: false, error: err.message });
    }
  }
};

async function runCleanupSequence(db, thresholds) {
  const rooms = await getAllRooms(db);

  for (const room of rooms) {
    await checkPause();

    const maxLimit = room.type === 'group' ? thresholds.groupMax : thresholds.directMax;
    const allMessageIds = await getRoomMessageIdsSorted(db, room.id);

    // 1. Batched Incremental Deletes for excess messages
    if (allMessageIds.length > maxLimit) {
      const excessIds = allMessageIds.slice(maxLimit);
      for (let i = 0; i < excessIds.length; i += BATCH_SIZE) {
        await checkPause();
        const batch = excessIds.slice(i, i + BATCH_SIZE);
        await deleteMessagesBatch(db, batch);
        await sleep(BATCH_DELAY_MS);
      }
    }

    // 2. Media-Aware Pruning: Redact media URL payloads beyond the mediaLimit
    const mediaLimit = thresholds.mediaLimit;
    const mediaMessageIds = await getRoomMediaMessageIds(db, room.id);

    if (mediaMessageIds.length > mediaLimit) {
      const excessMediaIds = mediaMessageIds.slice(mediaLimit);
      for (let i = 0; i < excessMediaIds.length; i += BATCH_SIZE) {
        await checkPause();
        const batch = excessMediaIds.slice(i, i + BATCH_SIZE);
        await redactMediaBatch(db, batch);
        await sleep(BATCH_DELAY_MS);
      }
    }
  }

  // 3. Room-Level LRU Eviction: runs if total DB storage exceeds 45MB soft limit
  await checkPause();
  await handleLRUEviction(db);
}

// Native IndexedDB Wrappers to bypass dependency resolver errors inside Web Workers
function getAllRooms(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['rooms'], 'readonly');
    const store = transaction.objectStore('rooms');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getRoomMessageIdsSorted(db, roomId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('room_id+created_at');
    const range = IDBKeyRange.bound([roomId, ''], [roomId, '\uffff']);
    const ids = [];

    const request = index.openCursor(range, 'prev'); // Reverse sort (newest first)
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        ids.push(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve(ids);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function getRoomMediaMessageIds(db, roomId) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('room_id+created_at');
    const range = IDBKeyRange.bound([roomId, ''], [roomId, '\uffff']);
    const ids = [];

    const request = index.openCursor(range, 'prev');
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        const msg = cursor.value;
        // Collect messages that have media
        if (msg.has_media === 1) {
          // Exclude promoted media (access_count >= 3) from pruning
          const currentMetadata = msg.media_metadata || {};
          const accessCount = currentMetadata.access_count || 0;
          if (accessCount < 3) {
            ids.push(cursor.primaryKey);
          }
        }
        cursor.continue();
      } else {
        resolve(ids);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

function deleteMessagesBatch(db, ids) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    ids.forEach(id => store.delete(id));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function redactMediaBatch(db, ids) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');

    let count = 0;
    ids.forEach(id => {
      const request = store.get(id);
      request.onsuccess = (e) => {
        const msg = e.target.result;
        if (msg) {
          // Remove URL, but keep aspect ratio, blurhash, and status intact
          msg.media_url = undefined; 
          msg.has_media = 0; 
          if (msg.content === '' || msg.content === 'Photo') {
            msg.content = '📷 Image (expired locally)';
          }
          store.put(msg);
        }
        count++;
        if (count === ids.length) {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });

    transaction.oncomplete = () => {
      if (count === 0) resolve();
    };
  });
}

async function handleLRUEviction(db) {
  // Evicts stale rooms if storage limit exceeded
  if (navigator.storage && navigator.storage.estimate) {
    const { usage } = await navigator.storage.estimate();
    const MAX_STORAGE_USAGE_BYTES = 45 * 1024 * 1024; // 45MB

    if (usage && usage > MAX_STORAGE_USAGE_BYTES) {
      const transaction = db.transaction(['rooms'], 'readonly');
      const store = transaction.objectStore('rooms');
      const rooms = await new Promise((res) => {
        const req = store.getAll();
        req.onsuccess = () => res(req.result);
      });

      // Sort by last_opened_at ascending (LRU)
      const staleRooms = rooms
        .filter(r => r.last_opened_at < Date.now() - (14 * 24 * 60 * 60 * 1000)) // 14 days idle
        .sort((a, b) => a.last_opened_at - b.last_opened_at);

      for (const room of staleRooms) {
        await checkPause();
        const ids = await getRoomMessageIdsSorted(db, room.id);
        if (ids.length > 10) {
          const toDelete = ids.slice(10); // Keep only 10 message previews
          for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
            await checkPause();
            await deleteMessagesBatch(db, toDelete.slice(i, i + BATCH_SIZE));
            await sleep(BATCH_DELAY_MS);
          }
        }
      }
    }
  }
}
