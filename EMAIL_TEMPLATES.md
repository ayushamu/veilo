# Veilo Premium Email Templates

This file documents the premium, responsive HTML email templates designed for **Veilo**. These templates match the **Mystic Emerald** dark aesthetic, featuring rounded details, vibrant emerald accents, and custom support links to `help.veilo@gmail.com`.

---

## 1. OTP Verification Code Template
* **Purpose**: Sent to AMU students logging in or registering.
* **Supabase / Resend Placement**: Paste directly into **Supabase Auth -> Email Templates -> Confirm Signup / Magic Link** or render via React Email in Resend.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Veilo OTP Verification</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #08080C;
      color: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #08080C;
      padding: 40px 0;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background-color: #12121A;
      border: 1px solid #1E2024;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 24px 16px 24px;
      text-align: center;
      border-bottom: 1px solid #1E2024;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #00F0A0;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .content {
      padding: 32px 24px;
      text-align: center;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 12px 0;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #8E8E9F;
      margin: 0 0 24px 0;
    }
    .otp-card {
      background-color: #08080C;
      border: 1.5px dashed #00F0A0;
      border-radius: 12px;
      padding: 16px 24px;
      display: inline-block;
      margin-bottom: 24px;
    }
    .otp-code {
      font-size: 32px;
      font-weight: 800;
      color: #00F0A0;
      letter-spacing: 6px;
      font-family: 'Courier New', Courier, monospace;
    }
    .btn {
      display: inline-block;
      background-color: #00F0A0;
      color: #08080C !important;
      font-weight: 700;
      font-size: 14px;
      text-decoration: none;
      padding: 14px 28px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 4px 12px rgba(0, 240, 160, 0.2);
    }
    .footer {
      padding: 24px;
      background-color: #0B0B10;
      border-top: 1px solid #1E2024;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #555566;
      line-height: 16px;
      margin: 0 0 8px 0;
    }
    .support-link {
      color: #00F0A0;
      text-decoration: none;
    }
    .support-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="logo">Veilo</div>
      </div>
      
      <!-- Content -->
      <div class="content">
        <h1>Verify your campus email</h1>
        <p>Use the 6-digit verification code below to establish your anonymous profile and enter the campus discussion.</p>
        
        <!-- OTP Display -->
        <div class="otp-card">
          <div class="otp-code">{{ .Token }}</div>
        </div>
        
        <p style="font-size: 11px; color: #555566; margin-top: 12px;">This code is valid for 15 minutes and can only be used once.</p>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">Veilo is an exclusive anonymous community for verified AMU students.</p>
        <p class="footer-text">Need help? Reach out to us at <a href="mailto:help.veilo@gmail.com" class="support-link">help.veilo@gmail.com</a>.</p>
        <p class="footer-text" style="margin-top: 16px; font-size: 9px; letter-spacing: 1px; color: #3C3C4A; text-transform: uppercase;">Veilo Campus Platform</p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 2. Onboarding Welcome Template
* **Purpose**: Sent to the user's verified inbox as soon as they complete their onboarding (shuffled their nickname and chosen gender). Excellent for reinforcing the privacy declaration.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Veilo</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #08080C;
      color: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #08080C;
      padding: 40px 0;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background-color: #12121A;
      border: 1px solid #1E2024;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 24px 16px 24px;
      text-align: center;
      border-bottom: 1px solid #1E2024;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #00F0A0;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .content {
      padding: 32px 24px;
      text-align: left;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 16px 0;
      text-align: center;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #8E8E9F;
      margin: 0 0 16px 0;
    }
    .bullet-point {
      margin-bottom: 14px;
      padding-left: 12px;
      border-left: 2px solid #00F0A0;
    }
    .bullet-title {
      font-size: 14px;
      font-weight: 700;
      color: #FFFFFF;
      margin-bottom: 2px;
    }
    .bullet-desc {
      font-size: 13px;
      color: #8E8E9F;
      line-height: 18px;
    }
    .footer {
      padding: 24px;
      background-color: #0B0B10;
      border-top: 1px solid #1E2024;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #555566;
      line-height: 16px;
      margin: 0 0 8px 0;
    }
    .support-link {
      color: #00F0A0;
      text-decoration: none;
    }
    .support-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="logo">Veilo</div>
      </div>
      
      <!-- Content -->
      <div class="content">
        <h1>Welcome to the Campus Chat!</h1>
        <p>Your official university email has been verified successfully. Your anonymous profile is now active on the network.</p>
        
        <p style="font-weight: 700; color: #FFFFFF; margin-top: 24px; margin-bottom: 12px;">Core Privacy Guidelines:</p>
        
        <div class="bullet-point">
          <div class="bullet-title">Total Peer-to-Peer Anonymity</div>
          <div class="bullet-desc">Other students can only see your current shuffled nickname and avatar. Your real email is cryptographically hashed and never exposed.</div>
        </div>
        
        <div class="bullet-point">
          <div class="bullet-title">One Active Account Limit</div>
          <div class="bullet-desc">To prevent spam and impersonation, each AMU student email address is restricted to a single active profile at any given time.</div>
        </div>
        
        <div class="bullet-point">
          <div class="bullet-title">Campus Code of Conduct</div>
          <div class="bullet-desc">Veilo is a collaborative campus forum. Avoid harassment, hate speech, or domain leakage attempts. Violating guidelines will trigger account suspension.</div>
        </div>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">Need support or have security questions? Reach out to us at <a href="mailto:help.veilo@gmail.com" class="support-link">help.veilo@gmail.com</a>.</p>
        <p class="footer-text" style="margin-top: 16px; font-size: 9px; letter-spacing: 1px; color: #3C3C4A; text-transform: uppercase;">Veilo Platform Security</p>
      </div>
    </div>
  </div>
</body>
</html>
```

---

## 3. Anonymous Safety Report Confirmation
* **Purpose**: Sent to the email inbox of the student who submitted a safety report. Confirms that their report was recorded safely without exposing their nickname or email to the moderators.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Report Received</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #08080C;
      color: #FFFFFF;
      margin: 0;
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #08080C;
      padding: 40px 0;
    }
    .container {
      max-width: 480px;
      margin: 0 auto;
      background-color: #12121A;
      border: 1px solid #1E2024;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
    }
    .header {
      padding: 32px 24px 16px 24px;
      text-align: center;
      border-bottom: 1px solid #1E2024;
    }
    .logo {
      font-size: 28px;
      font-weight: 800;
      color: #00F0A0;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .content {
      padding: 32px 24px;
      text-align: center;
    }
    .icon {
      font-size: 40px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 0 0 12px 0;
    }
    p {
      font-size: 14px;
      line-height: 22px;
      color: #8E8E9F;
      margin: 0 0 24px 0;
    }
    .badge {
      display: inline-block;
      background-color: rgba(255, 75, 114, 0.1);
      border: 1px solid rgba(255, 75, 114, 0.3);
      color: #FF4B72;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 6px 16px;
      border-radius: 999px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    .footer {
      padding: 24px;
      background-color: #0B0B10;
      border-top: 1px solid #1E2024;
      text-align: center;
    }
    .footer-text {
      font-size: 11px;
      color: #555566;
      line-height: 16px;
      margin: 0 0 8px 0;
    }
    .support-link {
      color: #00F0A0;
      text-decoration: none;
    }
    .support-link:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <!-- Header -->
      <div class="header">
        <div class="logo">Veilo</div>
      </div>
      
      <!-- Content -->
      <div class="content">
        <div class="icon">🛡️</div>
        <div class="badge">Report Logged</div>
        <h1>Your Safety Report has been Recorded</h1>
        <p>Thank you for helping keep the AMU campus community safe. We have logged your anonymous safety ticket.</p>
        <p style="text-align: left; font-size: 13px; padding: 14px; background-color: #08080C; border: 1px solid #1E2024; border-radius: 8px;">
          <strong>Security Notice:</strong> To guarantee absolute anonymity, our database stores this report by linking the offender's profile directly. Your email is completely redacted and was not recorded on the safety ticket. Moderators will review the chat snapshot and issue necessary blocks or bans.
        </p>
      </div>
      
      <!-- Footer -->
      <div class="footer">
        <p class="footer-text">Questions about safety or reporting? Contact us at <a href="mailto:help.veilo@gmail.com" class="support-link">help.veilo@gmail.com</a>.</p>
        <p class="footer-text" style="margin-top: 16px; font-size: 9px; letter-spacing: 1px; color: #3C3C4A; text-transform: uppercase;">Veilo Moderation Division</p>
      </div>
    </div>
  </div>
</body>
</html>
```
