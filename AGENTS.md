<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Veilo Developer & Agent Guidelines

Welcome, developer/agent! This file is the **single source of truth** for all architectural decisions, security invariants, file locations, data models, and engineering patterns in **Veilo**. Read the whole file before touching any code.

---

## 1. Project Overview

Veilo is a **premium, Gen-Z-styled, dark-mode-only, mobile-first anonymous chat platform** for verified Aligarh Muslim University (AMU) students. It is deployed as a **Progressive Web App (PWA)** — no native app binary exists.

* **Target Audience**: Exclusively verified AMU students.
* **Auth**: Email OTP **and** email/password — both restricted to `@myamu.ac.in` / `@amu.ac.in` domains.
* **Enrollment regex**: `^[a-z]{2}[0-9]{4}@(myamu\.ac\.in|amu\.ac\.in)$`
* **Anonymity Policy**: Peer-to-peer anonymity is absolute. A student's real-world email is **NEVER** visible to other users, stored in public tables, or exposed in frontend sessions.
* **Social links**: Instagram `@veilo.chat` · Website `veilo.chat`
* **Legal pages**: `/terms` and `/privacy` are live static pages (pre-rendered).

---

## 2. Technical Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 |
| BaaS | Supabase (Auth, Realtime Postgres CDC, PostgreSQL) |
| Object Storage | Cloudflare R2 (S3-compatible, presigned PUT + authenticated GET proxy) |
| Email OTP | Resend via Supabase Auth SMTP |
| Push Notifications | Firebase Cloud Messaging (FCM) via `src/lib/firebase.ts` |
| Offline DB | Dexie (IndexedDB wrapper) — `src/lib/db/local-db.ts` |
| State | Zustand — `src/hooks/use-inbox-store.tsx` |
| PWA | `next-pwa` — service worker, manifest, install prompt via `usePwa` hook |
| E2E Tests | Playwright — `e2e/` directory, `playwright.config.ts` |

---

## 3. Core Architectural Invariants (Do Not Break!)

### 🔒 Cryptographic Email Isolation (Privacy Boundary)
* Plain email addresses exist **only** in Supabase's internal `auth.users` table (not publicly queryable).
* `public.registered_emails` stores a **SHA-256 hash** of the lowercased email via `pgcrypto.digest()`.
* Trigger `on_profile_activated_hash_email` fires when `profiles.status` transitions `'onboarding' → 'active'`.
* The unique constraint on `email_hash` enforces **one active profile per student** without ever leaking emails.

### 🎓 Deterministic Global Room
* The campus-wide group chat has UUID `'00000000-0000-0000-0000-000000000000'`.
* Hardcoded display: name `"Global AMU Chat"`, emoji `🎓`.
* Trigger `on_profile_activated_join_global` auto-joins every new active user and inserts a `type: 'system'` welcome message.

### ☁️ Cloudflare R2 Media — Secure Proxy (Never Bypass!)
1. **Upload**: `getPresignedUploadUrl` (server action in `src/app/actions/media.ts`) verifies session + room membership, then returns a short-lived S3 PUT URL to bucket `veilo-chat-media`.
2. **Serve**: All media is served through `/api/media/[roomId]/[fileId]` (`src/app/api/media/[roomId]/[fileId]/route.ts`). This route verifies the cookie session participates in `roomId`, then streams the R2 object with `Cache-Control: public, max-age=31536000, immutable`.
3. **EXIF Strip**: `optimizeAndStripImage` in `src/lib/utils/media.ts` draws to an offscreen canvas (strips all EXIF/GPS metadata) and outputs WebP before upload.
4. **File size cap**: `MAX_IMAGE_UPLOAD_BYTES = 15 * 1024 * 1024` (15 MB raw; compressed to WebP before PUT).

### 📱 Layout Viewport Lock (DO NOT revert!)
The entire app is locked to the viewport using `h-screen overflow-hidden` on the outermost wrappers in `src/app/(app)/layout.tsx`. Inner pages use `h-full` — never `min-h-screen`. This ensures:
* Only the explicit `overflow-y-auto` message feed / chat list scrolls.
* The sticky header **never** scrolls away with the content (a bug caused by `min-h-screen`).
* **Rule**: When adding new routes under `(app)/`, always use `h-full` on `<main>`, never `min-h-screen`.

### 🔑 Dual Auth (OTP + Password)
Both paths are supported:
* **OTP flow**: `sendOTP` → `verifyOTP` (6-digit code, type `"email"`).
* **Password flow**: `signUpWithPassword` (creates account + triggers email verification) / `signInWithPassword`.
* `setUserPassword` / `sendPasswordReset` / `verifyResetOTP` (type `"recovery"`) handle the password management flow.
* After any successful auth, a `veilo-profile-status` cookie is set for middleware acceleration (30 days, `sameSite: lax`).
* Profile column `has_password: boolean` tracks whether the user has set a password.

### 🍪 Middleware Cookie Acceleration
`src/middleware.ts` reads the `veilo-profile-status` cookie to short-circuit route protection without a DB round-trip on every navigation. Cookie values: `'onboarding'` → redirect to `/onboarding`; `'active'` → allow into `(app)/`; absent → redirect to `/login`.

---

## 4. Next.js 15 Routing Conventions (Agent Checklist)

> [!WARNING]
> Next.js 15 treats `params` and `searchParams` as **Promises**. Always `await` them.

```typescript
interface PageProps {
  params: Promise<{ id: string }>;
}
export default async function ChatRoomPage({ params }: PageProps) {
  const { id } = await params;
}
```

> [!WARNING]
> Avoid hydration mismatches. Never use `typeof window !== 'undefined'` in component render paths. Use `useLayoutEffect` aliased with SSR fallback (see §6).

---

## 5. Complete Directory Map

```
src/
├── app/
│   ├── (auth)/                    # Unauthenticated screens
│   │   ├── login/                 # Email + password or OTP login page
│   │   ├── verify/                # 6-digit OTP entry
│   │   └── onboarding/            # Nickname + avatar picker, profile activation
│   ├── (app)/                     # Authenticated screens — h-screen locked layout
│   │   ├── layout.tsx             # InboxProvider wrapper, h-screen/h-full layout
│   │   ├── chats/
│   │   │   ├── page.tsx           # Chat inbox list (h-full, flex-1 overflow-y-auto section)
│   │   │   └── [id]/
│   │   │       ├── page.tsx       # Async server component — awaits params, passes data to client
│   │   │       └── ChatRoomClient.tsx  # Full chat UI (1863 lines) — see §6
│   │   ├── discover/              # Tinder-style confessions feed (DiscoverClient.tsx)
│   │   └── profile/               # Profile settings (avatar, nickname, password)
│   ├── actions/                   # Server Actions (all marked "use server")
│   │   ├── auth.ts                # sendOTP, verifyOTP, signUpWithPassword, signInWithPassword,
│   │   │                          # setUserPassword, sendPasswordReset, verifyResetOTP, signOut
│   │   ├── chats.ts               # resolveDirectMessageRoom
│   │   ├── confessions.ts         # getNextConfessions, getMyConfessions, postConfession,
│   │   │                          # deleteConfession, markConfessionSeen, reactToConfession, replyToConfession
│   │   ├── media.ts               # getPresignedUploadUrl (R2 signed PUT)
│   │   ├── profile.ts             # updateProfile, getProfile
│   │   ├── push.ts                # sendDmNotification, saveFcmToken
│   │   └── report.ts              # submitSafetyReport (moderation)
│   ├── api/
│   │   └── media/[roomId]/[fileId]/route.ts  # Authenticated R2 proxy GET handler
│   ├── page.tsx                   # Cinematic public landing page (844 lines, "use client")
│   ├── layout.tsx                 # Root layout — Google Fonts, PWA meta, viewport
│   ├── globals.css                # Tailwind v4 directives + custom animations
│   ├── privacy/page.tsx           # Privacy Policy (static)
│   └── terms/page.tsx             # Terms of Service (static)
│
├── components/
│   ├── auth/
│   │   └── PasswordPrompt.tsx     # Modal for setting/confirming password
│   ├── chat/
│   │   ├── MessageBubble.tsx      # Individual message renderer (reactions, reply, forward, system)
│   │   └── ImageViewerModal.tsx   # Full-screen image viewer with pinch-zoom support
│   ├── common/
│   │   ├── BottomNav.tsx          # Bottom tab bar (Chats, Discover, Profile)
│   │   ├── ImageEditorModal.tsx   # Client-side image crop, highlight, redact (canvas-based)
│   │   ├── MessageComposer.tsx    # Input bar with emoji picker, camera, gallery, voice placeholder
│   │   └── PwaPrompt.tsx          # PWA install bottom sheet (beforeinstallprompt handler)
│   └── discover/
│       ├── ConfessionCard.tsx     # Single swipeable confession card
│       ├── DiscoverClient.tsx     # Tinder deck + post-whisper sheet (35 KB)
│       └── PostWhisperSheet.tsx   # Bottom sheet to compose a new confession
│
├── hooks/
│   ├── use-chat.ts                # Core realtime hook (1003 lines) — see §6
│   ├── use-cleanup.ts             # Background tab/visibility cleanup for Supabase channels
│   ├── use-fcm.ts                 # FCM token registration + foreground message handler
│   ├── use-inbox-store.tsx        # Zustand store + InboxProvider + realtime inbox sync
│   └── use-pwa.ts                 # PWA install prompt state (beforeinstallprompt)
│
├── lib/
│   ├── firebase.ts                # Firebase app init (FCM)
│   ├── constants/                 # Shared app-wide constants
│   ├── db/
│   │   └── local-db.ts            # Dexie IndexedDB schema: rooms, messages, mediaMetadata
│   ├── security/                  # Rate-limit helpers, input sanitization
│   ├── supabase/
│   │   ├── client.ts              # Browser Supabase client (singleton)
│   │   ├── server.ts              # Server-side Supabase client (async cookie adapter)
│   │   └── middleware.ts          # Middleware-compatible Supabase client
│   └── utils/
│       └── media.ts               # optimizeAndStripImage — canvas EXIF strip + WebP compress
│
├── store/
│   └── chat-history-store.ts      # Zustand store for paginated message history cache
│
└── middleware.ts                  # Route protection via veilo-profile-status cookie
```

---

## 6. Key Component Deep-Dives

### `use-chat.ts` — Realtime Chat Hook
The brain of every chat room. Do not bypass it.

| Export | Description |
|---|---|
| `Message` | Full message interface incl. `delivery_status`, `reactions`, `media_metadata`, `is_forwarded` |
| `ReplyDraft` | `{ messageId, content, senderNickname }` |
| `TypingUser` | `{ id, nickname, avatar_emoji }` |
| `useChat(roomId, currentUserId)` | Returns `{ messages, loadMore, sendMessage, addReaction, deleteMessage, pinMessage, markRead, typingUsers }` |

**Sort invariant**: `messages[0]` = **newest** (bottom of chat), `messages[messages.length - 1]` = **oldest** (top of chat). Pagination cursor must point to the oldest:
```typescript
const oldest = messages[messages.length - 1];
```

**PAGE_SIZE**: 30 messages per page.

**Optimistic sends**: Messages are inserted locally with `delivery_status: 'sending'`, then reconciled on Supabase realtime confirmation. Failures set `delivery_status: 'failed'` with a `client_message_id` for retry.

### `ChatRoomClient.tsx` — Chat UI (1863 lines)
Key state and refs:

| State/Ref | Purpose |
|---|---|
| `roomData` | `{ name, avatar_emoji, type, pinned_message_id }` |
| `pinnedMessage` | Currently pinned message banner |
| `replyingTo` | Active reply draft |
| `selectedMessage` | Message with context menu open |
| `forwardingMessage` | Message being forwarded to another room |
| `selectedPeerProfile` | Peer profile card shown on avatar tap |
| `viewingImageUrl` | Full-screen image viewer URL |
| `swipeState` | Active swipe-to-reply gesture state |
| `mainRef` | Ref to `<main>` — used for scroll operations |
| `scrollContainerRef` | Ref to `overflow-y-auto` message feed div |

**Layout structure** (all `h-full`, no `min-h-screen`):
```
<main h-full flex flex-col>
  <header sticky top-0>          ← never scrolls
  <div flex-1 overflow-y-auto>   ← ONLY this scrolls
  <MessageComposer>              ← never scrolls
</main>
```

### `use-inbox-store.tsx` — Inbox State
* Zustand store backed by `sessionStorage` cache (`veilo:chat-inbox:v1`, TTL 5 min).
* Primary data source: Supabase RPC `get_chat_inbox` (falls back to manual `room_participants` join on error).
* `patchRoom(roomId, partial)` — optimistically updates a single room in the list without re-fetching. Always use this inside `ChatRoomClient` (via scoped selector to avoid re-renders).
* `InboxProvider` wraps the entire `(app)/layout.tsx` and sets up realtime CDC listeners for `messages` and `room_participants`.

### `MessageBubble.tsx` — Message Renderer
* Root div uses `flex items-end h-fit` — **never** `min-h-screen` or unstretched flex.
* System messages with a valid `senderId` (not current user) render as `<button>` elements triggering `onPeerClick` → opens peer profile card.
* Emoji-only messages get large font treatment (`isEmojiOnly` check).
* Reactions are rendered as pill buttons; long-press on a message opens the reaction picker.

---

## 7. Performance Engineering & Gesture Invariants

### ⚡ GPU-Accelerated Swipe-to-Reply
Do NOT call `setState` during `onPointerMove`. Use refs + direct DOM mutation:
```typescript
// CORRECT — zero React re-renders during drag
bubbleEl.style.transform = `translateX(${deltaX}px)`;
// WRONG — causes jank
setOffset(deltaX);
```

### ⚓ Scroll Anchoring on Pagination (Jitter Prevention)
Save `scrollHeight` + `scrollTop` in refs **before** calling `loadMore()`. Restore in `useLayoutEffect` **after** DOM update but **before** paint:
```typescript
const useLayoutEffect = typeof window !== "undefined" ? reactUseLayoutEffect : useEffect;

useLayoutEffect(() => {
  if (lastScrollHeightRef.current > 0) {
    const heightDiff = container.scrollHeight - lastScrollHeightRef.current;
    if (heightDiff > 0) {
      container.scrollTop = lastScrollTopRef.current + heightDiff;
    }
    lastScrollHeightRef.current = 0;
  }
}, [messages]);
```

### 🔄 Discover Feed Infinite Loop
* `getNextConfessions` calls RPC `get_unseen_confessions`. If 0 rows returned, it automatically falls back to `confessions` table (excluding own posts) so the feed never appears empty.
* Swiped cards are shifted to end of the local array client-side for recycling (no re-fetch needed).

### 📡 Realtime Cleanup
`use-cleanup.ts` (`useBackgroundCleanup`) removes Supabase realtime channels when the tab goes hidden or the component unmounts, preventing ghost subscriptions on low-end devices.

---

## 8. Database Tables (Public Schema — Key Ones)

| Table | Key Columns | Notes |
|---|---|---|
| `profiles` | `id, nickname, avatar_emoji, status ('onboarding'\|'active'), has_password` | 1:1 with `auth.users` |
| `registered_emails` | `email_hash` (unique) | SHA-256 of lowercase email — never stores plain email |
| `rooms` | `id, type ('direct'\|'group'), name, avatar_emoji, pinned_message_id` | |
| `room_participants` | `room_id, profile_id, last_read_at, is_muted` | |
| `messages` | `id, room_id, sender_id, content, type ('text'\|'image'\|'system'), media_url, reply_to_message_id, reply_to_content, reply_to_sender_nickname, is_forwarded, client_message_id, created_at` | |
| `message_reactions` | `message_id, profile_id, emoji` | Toggle: same emoji = delete, different = update |
| `confessions` | `id, profile_id, content, mood_emoji, gradient_id, allow_dm, created_at` | Max 280 chars |
| `confession_reactions` | `confession_id, profile_id, emoji` | Toggle reaction |
| `confession_seen` | `confession_id, profile_id` | Deduplication for unseen feed |

**RPCs used**:
- `get_chat_inbox()` — returns inbox rows sorted by `last_message_at` desc
- `get_unseen_confessions(current_user_id, limit_val)` — excludes own + seen confessions

---

## 9. PWA Configuration

* Install prompt handled by `usePwa` hook (`src/hooks/use-pwa.ts`) — captures `beforeinstallprompt`, defers it, exposes `{ isInstallable, promptInstall }`.
* `PwaPrompt.tsx` (`src/components/common/PwaPrompt.tsx`) renders the install bottom sheet on the landing page.
* Service worker and manifest are generated by `next-pwa` in `next.config.js`.
* PWA meta tags (theme color, apple touch icons, standalone display) are in `src/app/layout.tsx`.

---

## 10. Push Notifications (FCM)

* `use-fcm.ts` requests notification permission, fetches an FCM token, and registers it via `saveFcmToken` server action.
* `sendDmNotification` server action (`src/app/actions/push.ts`) dispatches FCM messages for direct message rooms.
* Firebase config lives in `src/lib/firebase.ts` (reads from `NEXT_PUBLIC_FIREBASE_*` env vars).

---

## 11. Server Action Return Convention

All server actions return `ActionResponse<T>`:
```typescript
interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;  // Human-readable error or success message
  data?: T;
}
```
Always check `result.success` before using `result.data`.

---

## 12. Helpful Commands

```bash
# Development
npm run dev

# Production build verification (run this before every commit)
npm run build

# E2E tests (requires VEILO_E2E_AUTH_ENABLED=true)
VEILO_E2E_AUTH_ENABLED=true npx playwright test

# Local Supabase
# Studio: http://localhost:54323
# API:    http://localhost:54321
# Migrations: supabase/migrations/
```

---

## 13. Recent Significant Changes (Commit History)

| Commit | Change |
|---|---|
| `7a2eba1` | **Fix**: Lock app layout to `h-screen` — header no longer scrolls with chat content |
| `ccaac14` | **Feat**: Cinematic landing page, Terms/Privacy pages, Instagram link, PWA install flow |
| `e8db951` | **Feat**: Dynamic SEO sitemap/robots.txt, premium login animations, FCM push dispatches |
| `6335281` | **Feat**: Tinder-style Discover (confessions) page, clickable join messages, scroll anchor + pagination cursor fix |
| `7a1a2fb` | **Feat**: Camera capture, WhatsApp emoji picker, message forwarding, login Terms modal |
| `50ee21b` | **Feat**: Saved Messages room, DM flow, realtime fixes, toast notifications |
| `5285edd` | **Feat**: PWA install prompt, client-side image editor (crop, highlight, redact) |

---

## 14. Agent Dos & Don'ts

| ✅ DO | ❌ DO NOT |
|---|---|
| Use `h-screen` on root layout wrappers | Use `min-h-screen` anywhere in `(app)/` |
| Use `h-full` on `<main>` inside pages | Bypass the R2 media proxy |
| `await params` in all App Router pages | Store or log plain email addresses |
| Use `useLayoutEffect` (SSR aliased) for scroll anchoring | Call `setState` during `onPointerMove` |
| Use `patchRoom` for optimistic inbox updates | Expose raw R2 presigned GET URLs to clients |
| Check AMU enrollment regex before sending OTP/signup | Skip the `has_password` flag when handling password auth |
| Run `npm run build` to verify before pushing | Add new routes without following the `h-full` layout rule |
