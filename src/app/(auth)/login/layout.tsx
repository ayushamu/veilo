import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join Veilo | Anonymous Campus Chat for AMU Students",
  description: "Verify your Aligarh Muslim University email address (@myamu.ac.in or @amu.ac.in) to join the secure, anonymous campus network. Share thoughts, join interest channels, and speak freely with complete privacy.",
  openGraph: {
    title: "Join Veilo | Verify your AMU Student Email",
    description: "Welcome to Veilo, the anonymous heart of Aligarh. Connect with verified AMU students safely and privately.",
    url: "https://veilo.shop/login",
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
