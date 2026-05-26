import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ChatRoomClient from "./ChatRoomClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatRoomPage({ params }: PageProps) {
  const { id } = await params;
  
  const supabase = await createClient();

  // 1. Get logged in user session (fast cookie check)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <ChatRoomClient
      roomId={id}
      currentUserId={user.id}
    />
  );
}
