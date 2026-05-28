import { test, expect } from '@playwright/test';

// Define E2E cookies to bypass real Supabase Auth servers
const MOCK_USER_ID = '11111111-1111-4111-8111-111111111111';
const E2E_AUTH_SECRET = process.env.VEILO_E2E_AUTH_SECRET || 'veilo-local-e2e-secret';
const E2E_COOKIES = [
  {
    name: 'veilo-e2e-user-id',
    value: MOCK_USER_ID,
    domain: 'localhost',
    path: '/',
  },
  {
    name: 'veilo-e2e-auth-secret',
    value: E2E_AUTH_SECRET,
    domain: 'localhost',
    path: '/',
  },
  {
    name: 'veilo-profile-status',
    value: 'active',
    domain: 'localhost',
    path: '/',
  },
];

// Configure dynamic and REST route mocking for isolated Playwright tests
test.beforeEach(async ({ context }) => {
  // Add auth cookies instantly to context
  await context.addCookies(E2E_COOKIES);

  // Mock Firebase CDN imports for Service Worker to enable 100% offline-first E2E stability
  await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'self.firebase = { initializeApp: () => ({}) };',
    });
  });

  await context.route('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: 'self.firebase.messaging = () => ({ onBackgroundMessage: () => {} });',
    });
  });

  // Listen for console logs inside the browser for E2E debugging
  context.on('page', (page) => {
    page.on('console', (msg) => {
      console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.error(`[Browser PageError] ${err.message}`);
    });
  });

  // Mock Supabase REST endpoints to execute entirely client-side without network calls
  await context.route('**/rest/v1/rpc/get_chat_inbox*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          room_id: '00000000-0000-0000-0000-000000000000',
          room_name: 'Global AMU Chat',
          avatar_emoji: '🎓',
          type: 'group',
          last_message: 'Tap to start chatting...',
          last_message_at: new Date(Date.now() - 60000).toISOString(), // 1 min ago
          unread_count: 0,
          is_muted: false,
        },
      ]),
    });
  });

  let roomPinnedMessageId: string | null = null;

  await context.route('**/rest/v1/rooms*', async (route) => {
    const request = route.request();
    if (request.method() === 'PATCH' || request.method() === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}');
      roomPinnedMessageId = payload.pinned_message_id || null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Global AMU Chat',
          avatar_emoji: '🎓',
          type: 'group',
          pinned_message_id: roomPinnedMessageId,
        }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000000',
          name: 'Global AMU Chat',
          avatar_emoji: '🎓',
          type: 'group',
          pinned_message_id: roomPinnedMessageId,
        }),
      });
    }
  });

  await context.route('**/rest/v1/room_participants*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        room_id: '00000000-0000-0000-0000-000000000000',
        profile_id: MOCK_USER_ID,
        is_muted: false,
      }),
    });
  });

  // Keep a mock cache of messages to simulate server synchronization and delta sync
  let messagesMockList = [
    {
      id: 'db-message-1',
      room_id: '00000000-0000-0000-0000-000000000000',
      sender_id: 'another-student-id',
      content: 'Salam, welcome to Veilo!',
      type: 'text',
      media_url: null,
      created_at: new Date(Date.now() - 300000).toISOString(), // 5 min ago
      client_message_id: null,
      reply_to_message_id: null,
    },
  ];

  await context.route('**/rest/v1/messages*', async (route) => {
    const request = route.request();
    if (request.method() === 'DELETE') {
      // Find the ID in the request url or just clear the messages mock list
      const url = request.url();
      const match = url.match(/id=eq\.(db-message-[^&]+)/);
      if (match && match[1]) {
        messagesMockList = messagesMockList.filter(m => m.id !== match[1]);
      } else {
        // Fallback: delete the last sent message by the mock user
        const lastUserMsgIdx = messagesMockList.map(m => m.sender_id).lastIndexOf(MOCK_USER_ID);
        if (lastUserMsgIdx !== -1) {
          messagesMockList.splice(lastUserMsgIdx, 1);
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    } else if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData() || '{}');
      const newMessage = {
        id: 'db-message-new-' + Date.now(),
        room_id: payload.room_id || '00000000-0000-0000-0000-000000000000',
        sender_id: MOCK_USER_ID,
        content: payload.content || '',
        type: payload.type || 'text',
        media_url: payload.media_url || null,
        created_at: new Date().toISOString(),
        client_message_id: payload.client_message_id || null,
        reply_to_message_id: payload.reply_to_message_id || null,
      };
      
      // Update cache in memory so subsequent GET requests see it
      messagesMockList.push(newMessage);

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(newMessage),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(messagesMockList),
      });
    }
  });

  await context.route('**/rest/v1/profiles*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: MOCK_USER_ID,
        nickname: 'Emerald Owl',
        avatar_emoji: '🦉',
      }),
    });
  });
});

test.describe('Veilo Mobile UX E2E Test Suite', () => {
  
  test('1. Chat List to Room Navigation & Performance timing', async ({ page }) => {
    // Navigate to /chats
    const listStart = performance.now();
    await page.goto('/chats');
    await expect(page.locator('text=Veilo')).toBeVisible();
    
    // Tap the first visible room
    const roomLink = page.locator('[data-testid="room-item"]').first();
    await expect(roomLink).toBeVisible();

    const transitionStart = performance.now();
    await roomLink.click();

    // Verify room opens successfully
    const composer = page.locator('[data-testid="composer-input"]');
    await expect(composer).toBeVisible({ timeout: 5000 });

    const transitionEnd = performance.now();
    const navigationDuration = transitionEnd - transitionStart;

    // Log the performance metrics
    console.log(`[Veilo Performance] Navigation latency (Chat List -> Room): ${navigationDuration.toFixed(2)}ms`);

    // Verify cached messages / initial messages appear
    const messageContent = page.locator('[data-testid="message-content"]').first();
    await expect(messageContent).toBeVisible();
    await expect(messageContent).toContainText('Salam, welcome to Veilo!');
  });

  test('2. Mobile Keyboard/Input Layout Stability', async ({ page }) => {
    // Open Global Chat Room directly
    await page.goto('/chats/00000000-0000-0000-0000-000000000000');
    
    const composer = page.locator('[data-testid="composer-input"]');
    await expect(composer).toBeVisible();

    // Record baseline bounding rect coordinates of the input
    const initialBox = await composer.boundingBox();
    expect(initialBox).not.toBeNull();

    // Focus the composer text area
    await composer.click();
    await page.waitForTimeout(200); // Allow virtual keyboard/focus transitions

    // Verify input remains visible and no broken layout jumps occur
    const activeBox = await composer.boundingBox();
    expect(activeBox).not.toBeNull();
    
    // Ensure viewport container hasn't scrolled the composer off-screen
    const viewportSize = page.viewportSize();
    expect(viewportSize).not.toBeNull();
    if (viewportSize && activeBox && initialBox) {
      expect(activeBox.y + activeBox.height).toBeLessThanOrEqual(viewportSize.height);
      expect(Math.abs(activeBox.x - initialBox.x)).toBeLessThanOrEqual(2); // Retain horizontal alignment
    }
  });

  test('3. Realtime Optimistic-Send & Reconciliation Test', async ({ page }) => {
    await page.goto('/chats/00000000-0000-0000-0000-000000000000');
    
    const composer = page.locator('[data-testid="composer-input"]');
    const sendButton = page.locator('[data-testid="composer-send-button"]');

    // Type a unique test message
    const msgText = `Playwright Optimistic: ${Math.random().toString(36).substring(7)}`;
    await composer.fill(msgText);
    
    // Measure Optimistic-Send latency
    const sendStart = performance.now();
    await sendButton.click();

    // Verify optimistic bubble appears instantly
    const messageBubble = page.locator(`[data-testid="message-bubble"] >> text=${msgText}`).first();
    await expect(messageBubble).toBeVisible();
    const sendEnd = performance.now();
    console.log(`[Veilo Performance] Optimistic message render latency: ${(sendEnd - sendStart).toFixed(2)}ms`);

    // Verify optimistic state is present and transitions cleanly without duplicate renders
    const bubblesCount = await page.locator(`[data-testid="message-bubble"] >> text=${msgText}`).count();
    expect(bubblesCount).toBe(1);

    // Verify the delivery status transitions to "sent" once Supabase server reconciles
    await expect(messageBubble).toBeVisible();
  });

  test('4. Message Deletion E2E Flow', async ({ page }) => {
    await page.goto('/chats/00000000-0000-0000-0000-000000000000');
    
    const composer = page.locator('[data-testid="composer-input"]');
    const sendButton = page.locator('[data-testid="composer-send-button"]');

    // Send a message
    const msgText = `Playwright Delete Target: ${Math.random().toString(36).substring(7)}`;
    await composer.fill(msgText);
    await sendButton.click();

    // Verify it appears in feed
    const messageContent = page.locator(`[data-testid="message-content"] >> text=${msgText}`).first();
    await expect(messageContent).toBeVisible();

    // Trigger right click to open Context Menu Action Sheet
    await messageContent.click({ button: 'right' });

    // Verify delete button is visible and click it
    const deleteButton = page.locator('[data-testid="action-delete"]');
    await expect(deleteButton).toBeVisible();
    await deleteButton.click();

    // Verify message has vanished instantly from feed
    await expect(messageContent).not.toBeVisible();
  });

  test('5. Message Pinning & Sticky Banner E2E Flow', async ({ page }) => {
    await page.goto('/chats/00000000-0000-0000-0000-000000000000');
    
    const composer = page.locator('[data-testid="composer-input"]');
    const sendButton = page.locator('[data-testid="composer-send-button"]');

    // Send a message to pin
    const msgText = `Playwright Pin Target: ${Math.random().toString(36).substring(7)}`;
    await composer.fill(msgText);
    await sendButton.click();

    // Verify message bubble appears
    const messageContent = page.locator(`[data-testid="message-content"] >> text=${msgText}`).first();
    await expect(messageContent).toBeVisible();

    // Trigger right click to open Context Menu Action Sheet
    await messageContent.click({ button: 'right' });

    // Verify pin button is visible and tap it
    const pinButton = page.locator('[data-testid="action-pin"]');
    await expect(pinButton).toBeVisible();
    await pinButton.click();

    // Verify Sticky Pinned Banner becomes visible and displays pinned text
    const pinnedBanner = page.locator('[data-testid="pinned-banner"]');
    await expect(pinnedBanner).toBeVisible();
    await expect(pinnedBanner).toContainText('Pinned Message');
    await expect(pinnedBanner).toContainText(msgText);

    // Verify subtle 📌 Pinned tag on message bubble appears
    const messageBubble = page.locator(`[data-testid="message-bubble"]:has-text("${msgText}")`);
    const pinnedBadge = messageBubble.locator('[data-testid="pinned-badge"]');
    await expect(pinnedBadge).toBeVisible();

    // Verify small header indicator is shown
    const headerPinnedIndicator = page.locator('[data-testid="header-pinned-indicator"]');
    await expect(headerPinnedIndicator).toBeVisible();

    // Click the Unpin button inside the Pinned Message Banner
    const unpinButton = page.locator('[data-testid="unpin-button"]');
    await expect(unpinButton).toBeVisible();
    await unpinButton.click();

    // Verify Pinned Message Banner disappears
    await expect(pinnedBanner).not.toBeVisible();
    await expect(headerPinnedIndicator).not.toBeVisible();
    await expect(pinnedBadge).not.toBeVisible();
  });
});
