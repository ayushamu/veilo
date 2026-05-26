<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Veilo Developer & Agent Guidelines

Welcome, developer/agent! This file contains complete context, architectural invariants, security rules, and code patterns needed to successfully maintain and extend **Veilo**, the mobile-first anonymous chat platform for Aligarh Muslim University (AMU) students.

---

## 1. Project Overview

Veilo is a premium, Gen-Z styled, dark-mode-only anonymous chat platform. 
* **Target Audience**: Exclusively verified AMU students.
* **Authentication**: Email OTP via `@myamu.ac.in` and `@amu.ac.in` domains.
* **Anonymity Policy**: Peer-to-peer anonymity is absolute. A student's real-world university email address is **NEVER** visible to other users, stored in public tables, or exposed in frontend sessions.

---

## 2. Technical Stack

* **Frontend**: Next.js 15 App Router (React 19, TypeScript, Tailwind CSS v4).
* **BaaS Backend**: Supabase (Auth, Realtime, PostgreSQL).
* **Object Storage**: Cloudflare R2 Bucket (S3-compatible, zero bandwidth egress fees).
* **Email OTP Delivery**: Resend integration via Supabase Auth SMTP.

---

## 3. Core Architectural Invariants (Do Not Break!)

### 🔒 Cryptographic Email Isolation (Privacy Boundary)
To prevent scraping or reverse-linking an anonymous nickname back to a real student's email, the database uses a cryptographic ledger:
* **The Rule**: Plain email addresses exist strictly in Supabase's internal `auth.users` table (which is inaccessible via public client queries).
* **Prevention Ledger**: The table `public.registered_emails` holds a **SHA-256 hash** of the user's lowercased email.
* **Database Trigger**: When a user updates their profile status from `'onboarding'` to `'active'`, the PostgreSQL trigger `on_profile_activated_hash_email` lowercases the email, hashes it via `pgcrypto.digest()`, and inserts it into `registered_emails`.
* **Security Action**: If a student registers a second account, the database unique constraint throws a violation on the `email_hash` column, aborting the transaction. This enforces the **one-active-profile-per-student** rule securely without leaking emails.

### 🎓 Deterministic Global Room
* **Guideline**: The default shared campus room is a group chat with a deterministic UUID: `'00000000-0000-0000-0000-000000000000'`.
* **Auto-Join Trigger**: When a user's status transitions to `'active'` during onboarding, the database trigger `on_profile_activated_join_global` automatically joins them as a participant to the Global Room and pushes a centered `'system'` welcome message.

### ☁️ Media sharing via Cloudflare R2 Secure Proxy
To prevent image hotlinking, scraping, or leakage of private media:
1. **Presigned PUT URL**: The server action `getPresignedUploadUrl` verifies the user's active session and room membership in PostgreSQL, then generates a short-lived PUT URL to `veilo-chat-media`.
2. **Secure Proxy Route**: Media URLs are styled as proxy calls: `/api/media/[roomId]/[fileId]`.
3. **GET Handler**: [src/app/api/media/[roomId]/[fileId]/route.ts](file:///Users/ayush/Downloads/veilo/src/app/api/media/[roomId]/[fileId]/route.ts) intercepts asset requests, verifies that the requesting user's cookie session participates in `roomId`, and only then streams the binary object from R2 with immutable cache headers. **Never bypass this proxy to expose raw R2 URLs directly!**
4. **EXIF Metadata Stripping**: [src/lib/utils/media.ts](file:///Users/ayush/Downloads/veilo/src/lib/utils/media.ts) draws uploaded images on an offscreen Canvas client-side. This natively strips all EXIF metadata (GPS tags, device tags, timestamps) and compresses images to WebP format before upload.

---

## 4. Next.js 15 Routing Conventions (Agent Checklist)

> [!WARNING]
> Next.js 15 introduces asynchronous param resolution in App Router pages, layout shells, and API handlers.
> Always treat `params` and `searchParams` as **Promises** that must be awaited.

**Correct Pattern**:
```typescript
interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatRoomPage({ params }: PageProps) {
  const { id } = await params; // Async Resolution
  // ...
}
```

---

## 5. Directory Structure & Abstractions

* `src/app/(auth)/`: Login, OTP Verify, and Onboarding screens.
* `src/app/(app)/chats/`: Conversation list screen.
* `src/app/(app)/chats/[id]/`: Asynchronous dynamic server component pulling details and rendering `ChatRoomClient`.
* `src/hooks/use-chat.ts`: Custom React hook binding all realtime channel listeners, message arrays, typing indicators, and reaction arrays.
* `src/lib/supabase/`: Client, server, and middleware wrappers (Next.js 15 Async Cookie Compatible).

---

## 6. Performance Engineering & Gesture Invariants

When extending or maintaining interactive elements in Veilo, always adhere to the following mobile-first optimizations:

### ⚡ GPU-Accelerated Gestures (Tinder Deck Swiping)
To achieve buttery-smooth 60fps drag physics on low-end Android Chrome devices:
* **The Rule**: Do NOT update React state (e.g. `useState`) during pointer movement (`onPointerMove`). State updates trigger full virtual DOM diffing on every frame, causing visual lag.
* **The Pattern**: Store drag coordinates in React refs (`useRef`) and mutate the DOM inline directly:
  ```typescript
  topCard.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${deltaX * 0.08}deg)`;
  ```
* **Infinite Looping Fallback**: Swiped card lists should be recycled client-side by shifting the swiped card to the end of the queue. On the server side, if `get_unseen_confessions` RPC returns 0 rows, the server action `getNextConfessions` automatically falls back to fetching already seen confessions (excluding the user's own) to ensure the campus feed never appears dead.

### ⚓ Synchronous DOM Scroll Anchoring (Pagination Jitter Prevention)
When prepending older chat messages to the top of a scroll container, adjusting scroll offsets asynchronously (e.g. in promises or timeouts) causes layout jumping because the browser repaints before the scroll position is updated.
* **The Pattern**: Save the stable previous `scrollHeight` and `scrollTop` in refs *just before* calling `loadMore()`.
* **The Update Hook**: Use `useLayoutEffect` (aliased to fallback to `useEffect` during SSR) to measure height changes and adjust `scrollTop` synchronously *after* DOM updates but *before* browser paint:
  ```typescript
  const useLayoutEffect = typeof window !== "undefined" ? reactUseLayoutEffect : useEffect;
  
  useLayoutEffect(() => {
    if (lastScrollHeightRef.current > 0) {
      const heightDiff = container.scrollHeight - lastScrollHeightRef.current;
      if (heightDiff > 0) {
        container.scrollTop = lastScrollTopRef.current + heightDiff;
      }
    }
  }, [messages]);
  ```

### 🧭 Pagination Cursor Direction
* **Sort Invariant**: The Hook `useChat` returns messages sorted **newest first** (`messages[0]` is the newest/bottom message). 
* **The Rule**: When paginating to fetch older messages, the query offset cursor MUST point to the oldest message in the array:
  ```typescript
  const oldest = messages[messages.length - 1]; // Correct oldest pointer
  ```

### 💬 Clickable Campus Entry System Messages
* Welcome messages sent by the auto-join database trigger use `type: 'system'` but register `sender_id` pointing to the new user.
* **The Pattern**: In `MessageBubble.tsx`, system messages that have a valid `senderId` (not matching `currentUserId`) and resolved details render as interactive `<button>` elements. Tapping them triggers `onPeerClick` to open the profile details card directly from the chat feed, facilitating immediate direct message responses.

---

## 7. Helpful Commands

### Run Development Server
```bash
npm run dev
```

### Compile Production Build Verification
```bash
npm run build
```

### Database Local Mock Ports
* Studio Dashboard: `http://localhost:54323`
* API Gate: `http://localhost:54321`
* Database Migrations Location: `supabase/migrations/`
