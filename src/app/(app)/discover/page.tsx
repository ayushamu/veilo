import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getNextConfessions } from "@/app/actions/confessions";
import DiscoverClient from "@/components/discover/DiscoverClient";

export const metadata = {
  title: "Discover · Veilo",
  description: "Anonymous confessions from your campus. Swipe, react, connect.",
};

export default async function DiscoverPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch current profile for the composer identity preview
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_emoji, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/onboarding");

  // Fetch initial batch of unseen confessions server-side
  const result = await getNextConfessions(15);
  const initialConfessions = result.success ? result.data ?? [] : [];

  return (
    <DiscoverClient
      initialConfessions={initialConfessions}
      currentUserId={user.id}
      currentNickname={profile.nickname}
      currentAvatar={profile.avatar_emoji}
    />
  );
}
