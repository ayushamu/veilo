import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Veilo",
  description: "Privacy Policy for using Veilo.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white selection:bg-[#00F0A0]/30 selection:text-[#00F0A0] relative font-sans">
      {/* Decorative Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[350px] h-[350px] bg-[#00F0A0]/5 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] bg-[#00D2FF]/3 rounded-full blur-[90px]" />
      </div>

      {/* Header */}
      <header className="border-b border-glass-border bg-[#080808]/40 backdrop-blur-xl relative z-10">
        <div className="flex justify-between items-center px-6 lg:px-24 py-5 max-w-[1440px] mx-auto">
          <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <img alt="Veilo Logo" className="w-8 h-8 object-contain" src="/icon-192.png" />
            <span className="font-hanken text-xl font-black text-[#00F0A0] tracking-tighter">Veilo</span>
          </Link>
          <Link 
            href="/login" 
            className="text-xs font-bold text-zinc-400 hover:text-white border border-zinc-800 rounded-full px-5 py-2 hover:bg-white/5 transition-all duration-300"
          >
            Back to App
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-16 relative z-10">
        <div className="glass-card p-8 md:p-12 rounded-3xl border-zinc-800/80">
          <h1 className="font-hanken text-3xl md:text-4xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Privacy Policy
          </h1>
          <p className="text-xs text-zinc-500 font-sans mb-8">
            Last Updated: 26 May 2026
          </p>

          <p className="text-sm text-zinc-300 leading-relaxed mb-8">
            Welcome to Veilo. Veilo is an anonymous communication platform designed exclusively for verified university students. Your privacy is fundamental to our service. This Privacy Policy explains what information we collect, how we use it, how we protect it, and the choices available to you. By creating an account or using Veilo, you agree to this Privacy Policy.
          </p>

          <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">1. Our Commitment to Anonymity</h2>
              <p>
                Veilo is designed to keep users anonymous from other users. Your university email address is used solely for:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Student verification</li>
                <li>Authentication</li>
                <li>Account security & recovery</li>
                <li>Abuse prevention</li>
              </ul>
              <p>
                Your email address is never displayed publicly within Veilo. Other users cannot view your email address, your real name (unless you voluntarily disclose it), your authentication records, or your internal account identifiers.
              </p>
              <p>
                Your public identity consists only of:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Anonymous nickname</li>
                <li>Selected avatar</li>
                <li>Gender selected during onboarding (if displayed)</li>
              </ul>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">2. Information We Collect</h2>
              <div>
                <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider mb-1">Account Information</h4>
                <p className="text-zinc-400">When creating an account, we may collect: university email address, authentication identifiers, account creation timestamp, and account status information.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider mb-1">Profile Information</h4>
                <p className="text-zinc-400">You may provide: gender selection, avatar selection, and your anonymous display name.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider mb-1">User Content</h4>
                <p className="text-zinc-400">We collect content you submit including: messages, group chat messages, direct messages, uploaded images, and reports submitted to moderators.</p>
              </div>
              <div>
                <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider mb-1">Device & Technical Information</h4>
                <p className="text-zinc-400">To maintain security and platform functionality, we may collect: IP address, browser type, device information, operating system, usage logs, and error reports.</p>
              </div>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">3. How We Use Information</h2>
              <p>We use the information we collect to:</p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Verify student eligibility & authenticate users</li>
                <li>Operate the platform, deliver messages, and serve media</li>
                <li>Prevent spam, abuse, and investigate reports</li>
                <li>Enforce platform rules, improve reliability, and protect users</li>
              </ul>
              <p className="font-medium text-zinc-200">
                We do not sell personal information to advertisers or third parties.
              </p>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">4. How We Protect Your Information</h2>
              <p>
                Veilo uses industry-standard security measures including: encrypted network connections (HTTPS), secure authentication systems, access controls, database security protections, and regular security monitoring.
              </p>
              <p>
                Only authorized personnel may access restricted account information when necessary for security, moderation, legal compliance, or technical support.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">5. Anonymous Identity Separation</h2>
              <p>Veilo maintains a strict database separation between:</p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>
                  <span className="text-zinc-200 font-semibold">Private Account Data</span>: Email address, authentication records, and security details.
                </li>
                <li>
                  <span className="text-zinc-200 font-semibold">Public Profile Data</span>: Nickname, avatar, and public profile information.
                </li>
              </ul>
              <p>
                This cryptographic and layout separation helps preserve absolute user anonymity within the platform.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">6. Sharing of Information</h2>
              <p>
                We do not sell or rent personal information. Information may be shared only:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>With service providers necessary to operate Veilo</li>
                <li>When required by law</li>
                <li>To investigate abuse or security incidents</li>
                <li>To protect the rights, safety, or security of users or the platform</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">7. User Reports & Moderation</h2>
              <p>
                When users submit reports: relevant messages or content may be reviewed, moderators may investigate violations, and appropriate enforcement actions may be taken. Reported content may be retained longer when necessary for investigations.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">8. Data Retention</h2>
              <p>
                We retain information only as long as reasonably necessary to operate the service, maintain security, investigate abuse, or comply with legal obligations. Data may be deleted, anonymized, or archived when no longer required.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">9. Account Deletion</h2>
              <p>
                Users may request account deletion. Upon deletion, public profile information may be removed or anonymized. Authentication information may be deleted subject to security, legal, and abuse-prevention requirements. Certain records may be retained where required by law.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">10. User Rights</h2>
              <p>
                Depending on applicable law, users may have rights to access their information, correct inaccurate information, request deletion of information, object to certain processing activities, or receive information regarding stored data. Requests may be submitted through Veilo support channels.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">11. Children&apos;s Privacy</h2>
              <p>
                Veilo is intended for university students and is not directed toward children under the age of 18. Individuals under the applicable minimum age should not use the platform.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">12. International Users</h2>
              <p>
                Information may be processed and stored in jurisdictions where Veilo or its service providers operate. By using Veilo, you consent to such processing where permitted by applicable law.
              </p>
            </section>

            {/* Section 13 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">13. Policy Updates</h2>
              <p>
                We may update this Privacy Policy periodically. Updated versions will be published within the platform or on the website. Continued use of Veilo after updates become effective constitutes acceptance of the revised policy.
              </p>
            </section>

            {/* Section 14 */}
            <section className="space-y-3 pb-4">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">14. Contact</h2>
              <p>
                For privacy-related questions, requests, or concerns, users may contact: <br />
                Email: <a href="mailto:help.veilo@gmail.com" className="text-[#00F0A0] hover:underline font-medium">help.veilo@gmail.com</a> <br />
                Instagram: <a href="https://instagram.com/veilo.chat" target="_blank" rel="noopener noreferrer" className="text-[#00F0A0] hover:underline font-medium">@veilo.chat</a>
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
