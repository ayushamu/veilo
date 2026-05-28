import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileClient from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();

  // 1. Authenticate user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch profile summary
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  // 3. Fetch user blocks count
  const { count: blockCount } = await supabase
    .from("user_blocks")
    .select("*", { count: "exact", head: true })
    .eq("blocker_id", user.id);

  // Mask Email securely matching the user plan specification
  const maskEmail = (email: string) => {
    if (!email) return "student@myamu.ac.in";
    const parts = email.split("@");
    if (parts.length !== 2) return email;
    const [name, domain] = parts;
    const nameStart = name[0] || "";
    const stars = "*".repeat(Math.max(name.length - 2, 3));
    return `${nameStart}${stars}@${domain}`;
  };

  const maskedEmail = maskEmail(user.email || "");

  // Format joined date (e.g. "May 2026")
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } catch {
      return "Joined recently";
    }
  };

  const joinedDate = formatDate(profile.created_at);

  return (
    <ProfileClient
      profileSummary={{
        nickname: profile.nickname,
        avatar_emoji: profile.avatar_emoji,
        status: profile.status,
        maskedEmail,
        joinedDate,
        blockCount: blockCount || 0,
        hasPassword: profile.has_password,
      }}
    />
  );
}
