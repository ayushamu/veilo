import { InboxProvider } from "@/hooks/use-inbox-store";
import PwaPrompt from "@/components/common/PwaPrompt";
import { createClient } from "@/lib/supabase/server";
import PasswordPrompt from "@/components/auth/PasswordPrompt";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let hasPassword = true; // Safe default
  if (user) {
    const { data: profile, error: dbError } = await supabase
      .from("profiles")
      .select("has_password")
      .eq("id", user.id)
      .maybeSingle();
    
    if (dbError) {
      console.error("Error fetching has_password from profiles table:", dbError);
    }
    
    if (profile) {
      hasPassword = profile.has_password;
      console.log(`User ${user.id} has_password status from DB:`, hasPassword);
    } else {
      console.log(`No profile found for user ${user.id}, defaulted hasPassword to true.`);
    }
  }

  return (
    <InboxProvider>
      <div className="flex justify-center items-stretch h-screen overflow-hidden bg-black">
        <div className="w-full max-w-[480px] h-screen bg-background flex flex-col relative border-x border-zinc-900/50 shadow-[0_0_80px_rgba(0,0,0,0.95)] overflow-hidden">
          {children}
        </div>
      </div>
      <PwaPrompt />
      <PasswordPrompt hasPassword={hasPassword} />
    </InboxProvider>
  );
}
