import { InboxProvider } from "@/hooks/use-inbox-store";
import PwaPrompt from "@/components/common/PwaPrompt";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <InboxProvider>
      {children}
      <PwaPrompt />
    </InboxProvider>
  );
}
