# Resend SMTP Supabase Integration Guide

This guide details how to configure **Resend** as the custom SMTP email delivery engine for **Supabase Auth**, bypassing the default global testing rate limit (3 emails/hour).

---

## Step 1: Gather Credentials from Resend
To connect Supabase to Resend via SMTP, we need your Resend API Key. 

1. Log in to your [Resend Dashboard](https://resend.com/).
2. Navigate to **API Keys** in the left sidebar.
3. Click **Create API Key**.
4. Set the name to `supabase-auth-smtp` and permissions to **Full Access**.
5. Copy the generated key immediately (it looks like `re_123456789...`).
6. Set your Sender Email address:
   * **Sandbox (Testing)**: If you haven't bought a custom domain yet, your verified sender email is:
     ```
     onboarding@resend.dev
     ```
   * **Production**: If you verified a domain (e.g. `veilo.chat`), your sender email will be:
     ```
     auth@veilo.chat
     ```

---

## Step 2: Open SMTP Settings in Supabase
1. Open the [Supabase Dashboard](https://supabase.com/dashboard) and navigate to your project.
2. Click on **Auth** in the left-hand navigation sidebar (key icon).
3. Under the **Settings** sub-menu, click on **Providers**.
4. Scroll down the list of providers and expand the **SMTP** dropdown section.

---

## Step 3: Populate SMTP Parameters
Toggle the **Enable SMTP** switch to **ON** and fill out the fields exactly as follows:

| Field Name | Expected Configuration Value | Notes |
| :--- | :--- | :--- |
| **Sender Email** | `onboarding@resend.dev` OR `auth@yourdomain.chat` | Must match your verified Resend domain/sandbox |
| **Sender Name** | `Veilo` | The user-facing name appearing in the inbox |
| **SMTP Host** | `smtp.resend.com` | Standard Resend outbound gateway |
| **Port** | `587` | Recommended TLS port |
| **Username** | `resend` | **IMPORTANT**: Type this exact literal lowercase string: `resend` |
| **Password** | `re_your_api_key_here` | Paste your complete Resend API Key (starts with `re_`) |
| **Minimum Heartbeat**| `10` (Default) | Leave as default |

---

## Step 4: Save & Test
1. Click **Save** at the bottom of the SMTP settings panel in Supabase.
2. Launch your local dev server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000/login` in your mobile web emulator.
4. Enter your whitelisted student email (e.g. `gp5282@myamu.ac.in`) and click **Verify & Join**.
5. Supabase Auth will instantly trigger the SMTP transfer. Check your verified AMU inbox—the gorgeous custom Mystic Emerald email with your 6-digit OTP code will arrive in seconds!
