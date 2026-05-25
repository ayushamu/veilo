import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatRoomClient from "./ChatRoomClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatRoomPage({ params }: PageProps) {
  const { id } = await params;
  
  const supabase = await createClient();

  // 1. Get logged in user session
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Fetch room details from rooms table
  let roomName = "Anonymous Group";
  let avatarEmoji = "💬";
  let roomType: "direct" | "group" = "group";

  // Check if this is the global room first
  if (id === "00000000-0000-0000-0000-000000000000") {
    roomName = "Global AMU Chat";
    avatarEmoji = "🎓";
    roomType = "group";
  } else if (id === "mock-dm-techiegeek") {
    roomName = "TechieGeek";
    avatarEmoji = "🤖";
    roomType = "direct";
  } else if (id === "mock-dm-ecowarrior") {
    roomName = "EcoWarrior";
    avatarEmoji = "🌱";
    roomType = "direct";
  } else {
    // Database Room Lookup
    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (roomData) {
      roomName = roomData.name || "Anonymous Chat";
      avatarEmoji = roomData.avatar_emoji || "💬";
      roomType = roomData.type;

      // If DM, resolve other participant nickname and avatar
      if (roomData.type === "direct") {
        const { data: peer } = await supabase
          .from("room_participants")
          .select("profile_id")
          .eq("room_id", id)
          .neq("profile_id", user.id)
          .maybeSingle();

        if (peer && peer.profile_id) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("nickname, avatar_emoji")
            .eq("id", peer.profile_id)
            .maybeSingle();

          if (profile) {
            roomName = profile.nickname;
            avatarEmoji = profile.avatar_emoji;
          }
        }
      }
    }
  }

  return (
    <ChatRoomClient
      roomId={id}
      initialRoomData={{
        name: roomName,
        avatar_emoji: avatarEmoji,
        type: roomType,
      }}
      currentUserId={user.id}
    />
  );
}
