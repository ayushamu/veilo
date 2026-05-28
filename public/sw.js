// Import Firebase App and Messaging Compat SDKs
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker
firebase.initializeApp({
  apiKey: "AIzaSyDu4owJiwIpna2QzY1sZ3Y8Y-ZjFMw6KJw",
  authDomain: "veilo-campus-chat.firebaseapp.com",
  projectId: "veilo-campus-chat",
  storageBucket: "veilo-campus-chat.firebasestorage.app",
  messagingSenderId: "871676060190",
  appId: "1:871676060190:web:673d52fad8bd708a9b840f"
});

const messaging = firebase.messaging();

// Handle Background Push Messages
messaging.onBackgroundMessage((payload) => {
  console.log("[sw.js] Received background message ", payload);
  
  const title = payload.notification?.title || payload.data?.title || "Veilo Message";
  const body = payload.notification?.body || payload.data?.body || "";
  
  const options = {
    body: body,
    icon: payload.notification?.icon || payload.data?.icon || "/icon-192.png",
    badge: "/icon-192.png", // Monochrome mask icon for status bar
    image: payload.notification?.image || payload.data?.image || undefined,
    data: payload.data || {},
    tag: payload.data?.roomId ? `chat-room-${payload.data.roomId}` : "general-dm",
    renotify: true, // Forces sound & vibration on existing active notification groups
    vibrate: [200, 100, 200], // Premium double-pulse vibration haptics
    actions: [
      {
        action: "enter",
        title: "💬 Chat Now"
      },
      {
        action: "dismiss",
        title: "✕ Dismiss"
      }
    ]
  };

  self.registration.showNotification(title, options);
});

// Handle Notification Clicks (PWA Deep-Link Reuse, zero tab duplication)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // If user clicked the custom "Dismiss" action, abort immediately
  if (event.action === "dismiss") {
    return;
  }

  const roomId = event.notification.data?.roomId;
  const targetUrl = roomId ? `/chats/${roomId}` : "/chats";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // 1. Try to find a client that is already on the exact target page and focus it
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname === targetUrl && "focus" in client) {
          return client.focus();
        }
      }

      // 2. Try to find any chats page client open and navigate it to the correct room, then focus
      for (const client of clientList) {
        const clientUrl = new URL(client.url);
        if (clientUrl.pathname.startsWith("/chats") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // 3. Fallback: Open a brand new window/tab if none are currently running
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

const CACHE_NAME = "veilo-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico"
];

// Install Event
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener("fetch", (event) => {
  // Only intercept GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  
  // Do not intercept Supabase Auth/API, real-time sync endpoints, or Hot Module Roller files
  if (
    url.pathname.startsWith("/api") || 
    url.pathname.includes("/_next/webpack-hmr") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache valid local static/assets responses
        if (
          response && 
          response.status === 200 && 
          response.type === "basic" &&
          !url.pathname.startsWith("/_next/static/webpack")
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // For page navigations, return root / as a fallback
          if (event.request.mode === "navigate") {
            return caches.match("/");
          }
        });
      })
  );
});
