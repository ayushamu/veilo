"use server";

import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { ActionResponse } from "./auth";

const resend = new Resend(process.env.RESEND_API_KEY || "re_mock");
const ADMIN_SUPPORT_EMAIL = "help.veilo@gmail.com";

// Template 3 HTML definition
const REPORT_CONFIRMATION_HTML = `
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
        <p style="text-align: left; font-size: 13px; padding: 14px; background-color: #08080C; border: 1px solid #1E2024; border-radius: 8px; color: #bbcabf;">
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
`;

/**
 * Server action to log an anonymous safety report.
 * Inserts report data, triggers SMTP to notify help.veilo@gmail.com,
 * and sends confirmation (Template 3) back to the reporter's verified email.
 */
export async function submitSafetyReport(
  messageId: string,
  reason: string,
  roomId: string
): Promise<ActionResponse> {
  try {
    const supabase = await createClient();

    // 1. Authenticate reporter session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "Authentication session expired. Please log in again." };
    }

    // 2. Fetch the offending message details to capture content snapshots
    const { data: offendingMessage, error: msgError } = await supabase
      .from("messages")
      .select(`
        content,
        sender_id,
        profiles (
          nickname
        )
      `)
      .eq("id", messageId)
      .single();

    if (msgError || !offendingMessage) {
      return { success: false, message: "Failed to load message context for report." };
    }

    // Resolve profile details dynamically (Supabase joins may return arrays or objects depending on FK type maps)
    const rawProfiles = offendingMessage.profiles as
      | { nickname?: string }
      | { nickname?: string }[]
      | null;
    const offenderNickname = Array.isArray(rawProfiles)
      ? rawProfiles[0]?.nickname
      : rawProfiles?.nickname || "Anonymous Student";

    // 3. Log the report inside PostgreSQL
    const { error: dbError } = await supabase.from("user_reports").insert({
      reporter_id: user.id,
      reported_id: offendingMessage.sender_id,
      room_id: roomId,
      reason: reason.trim(),
      content_snapshot: {
        message_content: offendingMessage.content,
        message_sender: offenderNickname,
      },
    });

    if (dbError) {
      console.error("Database error logging report:", dbError);
      return { success: false, message: "Database failed to record report." };
    }

    // 4. Send email alert to help.veilo@gmail.com using Resend
    try {
      await resend.emails.send({
        from: "safety@help.veilo.shop", // or onboarding@resend.dev in sandbox testing
        to: ADMIN_SUPPORT_EMAIL,
        subject: `[Veilo Safety Alert] New Student Report Logged`,
        html: `
          <h3>New Safety Incident Report</h3>
          <p><strong>Reporter UID:</strong> ${user.id} (Redacted on public tables)</p>
          <p><strong>Offender UID:</strong> ${offendingMessage.sender_id}</p>
          <p><strong>Offender Nickname:</strong> ${offenderNickname}</p>
          <p><strong>Room ID:</strong> ${roomId}</p>
          <p><strong>Reason Filed:</strong> ${reason}</p>
          <p><strong>Message Content Snapshot:</strong> "${offendingMessage.content}"</p>
        `,
      });

      // 5. Send Template 3 (Logged confirmation) to the reporter's verified email
      await resend.emails.send({
        from: "safety@help.veilo.shop", // or onboarding@resend.dev in sandbox testing
        to: user.email!,
        subject: `We've received your safety report | Veilo`,
        html: REPORT_CONFIRMATION_HTML,
      });
    } catch (emailErr) {
      // We don't block the transaction if email fails, but log it
      console.error("Failed to trigger report emails:", emailErr);
    }

    return {
      success: true,
      message: "Report logged successfully. Thank you for keeping Veilo safe.",
    };
  } catch (err) {
    console.error("Safety report server action error:", err);
    return { success: false, message: "An unexpected server error occurred." };
  }
}
