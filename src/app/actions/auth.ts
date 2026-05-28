"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

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

    let status = "onboarding";
    if (profile && !profileError) {
      status = profile.status;
    }

    // Set client status cookie for middleware acceleration (30 days)
    const cookieStore = await cookies();
    cookieStore.set("veilo-profile-status", status, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

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

/**
 * Signs up a new user with email and password.
 * Triggers email verification.
 */
export async function signUpWithPassword(
  email: string,
  password: string
): Promise<ActionResponse> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    
    // 1. Verify university domain whitelist
    const isValidDomain = 
      WhitelistedDomains.some((domain) => sanitizedEmail.endsWith(domain)) ||
      sanitizedEmail === "ayushcmf@gmail.com";
    
    if (!isValidDomain) {
      return {
        success: false,
        message: "Access restricted. You must sign up using an official AMU email address (@myamu.ac.in or @amu.ac.in).",
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
      email: sanitizedEmail,
      password: password,
      options: {
        data: {
          is_password_signup: true,
        },
      },
    });

    if (error) {
      console.error("Supabase password signup error:", error);
      return {
        success: false,
        message: error.message || "Failed to create account. Please try again.",
      };
    }

    return {
      success: true,
      message: "Verification code sent to your university email. Please verify to activate.",
    };
  } catch (err) {
    console.error("Password signup server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred. Please try again.",
    };
  }
}

/**
 * Signs in an existing user with email and password.
 */
export async function signInWithPassword(
  email: string,
  password: string
): Promise<ActionResponse<{ status: string }>> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email: sanitizedEmail,
      password,
    });

    if (error) {
      console.error("Supabase password signin error:", error);
      return {
        success: false,
        message: error.message || "Incorrect email or password. Please try again.",
      };
    }

    if (!data.user) {
      return {
        success: false,
        message: "Authentication succeeded but user session could not be established.",
      };
    }

    // Fetch onboarding status and update has_password to true since they logged in with password successfully
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status, has_password")
      .eq("id", data.user.id)
      .single();

    let status = "onboarding";
    if (profile && !profileError) {
      status = profile.status;
      if (!profile.has_password) {
        await supabase
          .from("profiles")
          .update({ has_password: true })
          .eq("id", data.user.id);
      }
    }

    // Set client status cookie for middleware acceleration (30 days)
    const cookieStore = await cookies();
    cookieStore.set("veilo-profile-status", status, {
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return {
      success: true,
      message: "Authentication successful.",
      data: { status },
    };
  } catch (err) {
    console.error("Password signin server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred during login. Please try again.",
    };
  }
}

/**
 * Sets or updates the password for the active authenticated user session.
 */
export async function setUserPassword(password: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    
    // 1. Update password in Supabase Auth
    const { error: authError } = await supabase.auth.updateUser({
      password: password,
    });

    if (authError) {
      console.error("Supabase password update error:", authError);
      return {
        success: false,
        message: authError.message || "Failed to update password. Please try again.",
      };
    }

    // 2. Update has_password in profiles table
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ has_password: true })
        .eq("id", user.id);

      if (dbError) {
        console.error("Failed to update has_password flag in profile:", dbError);
      }
    }

    return {
      success: true,
      message: "Password updated successfully.",
    };
  } catch (err) {
    console.error("Set password server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred. Please try again.",
    };
  }
}

/**
 * Triggers a password reset recovery OTP/link to the user's email.
 */
export async function sendPasswordReset(email: string): Promise<ActionResponse> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();
    
    const { error } = await supabase.auth.resetPasswordForEmail(sanitizedEmail);

    if (error) {
      console.error("Supabase send password reset error:", error);
      return {
        success: false,
        message: error.message || "Failed to send password reset code. Please try again.",
      };
    }

    return {
      success: true,
      message: "Password reset code sent successfully.",
    };
  } catch (err) {
    console.error("Send password reset server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred. Please try again.",
    };
  }
}

/**
 * Verifies a password recovery OTP.
 */
export async function verifyResetOTP(
  email: string,
  token: string
): Promise<ActionResponse> {
  try {
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedToken = token.trim();
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      email: sanitizedEmail,
      token: sanitizedToken,
      type: "recovery",
    });

    if (error) {
      console.error("Supabase verify reset OTP error:", error);
      return {
        success: false,
        message: error.message || "Incorrect verification code. Please check and try again.",
      };
    }

    return {
      success: true,
      message: "Verification successful. You can now set your new password.",
    };
  } catch (err) {
    console.error("Verify reset OTP server error:", err);
    return {
      success: false,
      message: "An unexpected server error occurred during verification. Please try again.",
    };
  }
}

/**
 * Signs the user out of their Supabase Auth session.
 */
export async function signOut(): Promise<ActionResponse> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, message: error.message };
    }
    
    // Clear client status cookie
    const cookieStore = await cookies();
    cookieStore.delete("veilo-profile-status");
    
    return { success: true };
  } catch (err) {
    console.error("Sign out server error:", err);
    return { success: false, message: "Server error during sign out." };
  }
}
