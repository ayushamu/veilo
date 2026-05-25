# Cloudflare R2 Storage Setup Guide

This guide will walk you through setting up a **Cloudflare R2 Bucket** and generating the S3-compatible API credentials required for the **Veilo** secure chat media upload system.

---

## Step 1: Create a Cloudflare Account
1. Head to [cloudflare.com](https://www.cloudflare.com/) and sign up for a free account (if you don't already have one).
2. Once logged in, click on the **R2** tab in the left sidebar navigation menu.
3. If prompted, subscribe to the R2 plan.
   * *Note*: Cloudflare R2 has an extremely generous **Free Tier**:
     * **10 GB / month** of storage completely free.
     * **1,000,000 Class A operations** (mutations / writes) per month free.
     * **10,000,000 Class B operations** (reads / downloads) per month free.
     * **Zero egress bandwidth charges** (downloading photos shared in chats will never cost you a cent).

---

## Step 2: Create Your R2 Bucket
1. Inside the R2 dashboard, click the **Create Bucket** button.
2. Enter a unique bucket name (e.g., `veilo-chat-media`).
3. Set the region to **Automatic** (recommended for low-latency Edge delivery).
4. Click **Create Bucket**.
5. Save your bucket name:
   ```env
   R2_BUCKET_NAME=veilo-chat-media
   ```

---

## Step 3: Find Your Cloudflare Account ID
1. Navigate back to the main **R2 Dashboard** (or your main Cloudflare Account Home).
2. Look at the right sidebar under **Account Details**.
3. You will see a long alphanumeric string labeled **Account ID**.
4. Copy this value and add it to your `.env.local` file:
   ```env
   CLOUDFLARE_ACCOUNT_ID=your_32_character_account_id
   ```

---

## Step 4: Generate R2 API Access Tokens
To allow the Next.js Server Action to issue secure upload presigned URLs, we must create an API token:

1. In the right-hand panel of the main R2 Overview page, click **Manage R2 API Tokens**.
2. Click **Create API Token**.
3. Configure the token options:
   * **Token Name**: Enter a name (e.g., `veilo-chat-service`).
   * **Permissions**: Select **Admin Read & Write** (required so the server can authorize PUT operations).
   * **Access**: Select **Specific buckets only** and check the checkbox next to your bucket name (`veilo-chat-media`) to enforce strict security boundaries.
   * **TTL (Expiration)**: Set to **Forever** (or a custom time frame if you plan to rotate keys).
4. Click **Create API Token**.
5. Cloudflare will display three keys. **Copy them immediately** as they will never be shown again:
   * **Access Key ID**: Map to `R2_ACCESS_KEY_ID`.
   * **Secret Access Key**: Map to `R2_SECRET_ACCESS_KEY`.

---

## Step 5: Configure CORS Policies
To allow users to upload images directly from their web browsers to your R2 bucket without encountering Cross-Origin Resource Sharing (CORS) blocks, you must enable PUT headers:

1. Inside your R2 bucket settings (`veilo-chat-media` -> **Settings** tab).
2. Scroll down to the **CORS Policy** section and click **Add CORS Policy** (or edit).
3. Paste the following production-grade configuration (JSON format) and click **Save**:
   ```json
   [
     {
       "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.vercel.app"],
       "AllowedMethods": ["GET", "PUT", "POST"],
       "AllowedHeaders": ["Content-Type", "Authorization"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

---

## Summary: Env Variables Mapping
Once completed, populate your `.env.local` file with the values retrieved:

```env
CLOUDFLARE_ACCOUNT_ID=xxxxxx...
R2_BUCKET_NAME=veilo-chat-media
R2_ACCESS_KEY_ID=xxxxxx...
R2_SECRET_ACCESS_KEY=xxxxxx...
```
