"use server";

import { createClient } from "@/lib/supabase/server";

const WhitelistedDomains = ["@myamu.ac.in", "@amu.ac.in"];

export interface ActionResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

/**
 * Triggers Supabase Email OTP auth for valid AMU email addresses.
 */
export async function sendOTP(email: string): Promise<ActionResponse> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    
    // 1. Verify university domain whitelist (with temporary developer email override)
    const isValidDomain = 
      WhitelistedDomains.some((domain) => sanitizedEmail.endsWith(domain)) ||
      sanitizedEmail === "ayushcmf@gmail.com";
    
    if (!isValidDomain) {
      return {
        success: false,
        message: "Access restricted. You must sign up using an official AMU email address (@myamu.ac.in or @amu.ac.in).",
      };
    }

    // 2. Initialize Server client and trigger OTP
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: sanitizedEmail,
      options: {
        shouldCreateUser: true, // Creates the auth.users record if new
      },
    });

    if (error) {
      console.error("Supabase OTP signin error:", error);
      return {
        success: false,
        message: error.message || "Failed to trigger verification code. Please try again.",
      };
    }

    return {
      success: true,
      message: "Verification code sent successfully to your university email.",
    };
  } catch (err) {
    console.error("Send OTP server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred. Please try again.",
    };
  }
}

/**
 * Verifies the 6-digit OTP code against Supabase Auth.
 */
export async function verifyOTP(
  email: string,
  token: string
): Promise<ActionResponse<{ status: string }>> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedToken = token.trim();

    if (sanitizedToken.length !== 6 || !/^\d+$/.test(sanitizedToken)) {
      return {
        success: false,
        message: "Invalid code format. Please enter a 6-digit number.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: sanitizedEmail,
      token: sanitizedToken,
      type: "email",
    });

    if (error) {
      console.error("Supabase OTP verification error:", error);
      return {
        success: false,
        message: error.message || "Incorrect verification code. Please check and try again.",
      };
    }

    if (!data.user) {
      return {
        success: false,
        message: "Verification succeeded but user session could not be established.",
      };
    }

    // 3. Fetch current onboarding status from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .single();

    if (profileError || !profile) {
      console.error("Profile lookup error after verify:", profileError);
      return {
        success: true,
        data: { status: "onboarding" }, // Default to onboarding if profile check fails
      };
    }

    return {
      success: true,
      message: "Authentication successful.",
      data: { status: profile.status },
    };
  } catch (err) {
    console.error("Verify OTP server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred during verification. Please try again.",
    };
  }
}
