import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Veilo",
  description: "Terms of Service and Community Guidelines for using Veilo.",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="text-xs text-zinc-500 font-sans mb-8">
            Last Updated: 26 May 2026
          </p>

          <p className="text-sm text-zinc-300 leading-relaxed mb-8">
            Welcome to Veilo. These Terms of Service (&quot;Terms&quot;) govern your access to and use of Veilo, including our website, applications, services, and features. By creating an account, accessing, or using Veilo, you agree to be bound by these Terms. If you do not agree, you may not use the platform.
          </p>

          <div className="space-y-8 text-sm text-zinc-300 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">1. About Veilo</h2>
              <p>
                Veilo is an anonymous communication platform designed for verified university students. Users may:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Join group conversations</li>
                <li>Participate in campus communities</li>
                <li>Exchange messages</li>
                <li>Share images</li>
                <li>Interact through anonymous profiles</li>
              </ul>
              <p className="text-zinc-500 text-xs">
                Veilo is not affiliated with, endorsed by, or operated by any university unless explicitly stated.
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">2. Eligibility</h2>
              <p>To use Veilo you must:</p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Be at least 18 years old</li>
                <li>Be a currently enrolled student with a valid university email address</li>
                <li>Complete account verification when required</li>
                <li>Comply with these Terms and all applicable laws</li>
              </ul>
              <p>
                Veilo may deny or revoke access at its discretion when eligibility requirements are not met.
              </p>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">3. Account Registration</h2>
              <p>
                To access certain features, users must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Maintaining access to your email account</li>
                <li>Protecting authentication credentials</li>
                <li>Ensuring account information remains accurate</li>
                <li>All activity occurring through your account</li>
              </ul>
              <p>You may not:</p>
              <ul className="list-disc list-inside pl-2 space-y-1.5 text-zinc-400">
                <li>Share, sell, or transfer accounts</li>
                <li>Create accounts using false identities</li>
                <li>Circumvent account restrictions</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">4. Anonymous Identity</h2>
              <p>
                Veilo provides anonymity between users. Your public profile may display an anonymous nickname, avatar, and selected profile attributes.
              </p>
              <p>
                Your university email address is used only for verification, security, moderation, and account recovery purposes. Anonymity does not exempt users from platform rules, moderation actions, or legal obligations.
              </p>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">5. Acceptable Use</h2>
              <p>
                You agree to use Veilo responsibly and respectfully. You may participate in discussions, join groups, send messages, share lawful content, and report inappropriate behavior. You are solely responsible for content you create, upload, or distribute.
              </p>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">6. Prohibited Activities</h2>
              <p className="font-semibold text-zinc-200">The following conduct is strictly prohibited:</p>
              <div className="space-y-3 pl-2">
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Harassment & Abuse</h4>
                  <p className="text-zinc-400 text-xs">Bullying, threats, intimidation, stalking, and targeted harassment.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Hate & Discrimination</h4>
                  <p className="text-zinc-400 text-xs">Content targeting individuals or groups based on religion, race, ethnicity, nationality, gender, sexual orientation, disability, or other protected characteristics.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Privacy Violations</h4>
                  <p className="text-zinc-400 text-xs">Doxxing, sharing private information, publishing personal details without consent, or revealing another user&apos;s real-world identity.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Impersonation</h4>
                  <p className="text-zinc-400 text-xs">Pretending to be another individual, misrepresenting affiliation, or making misleading identity claims.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Illegal & Explicit Content</h4>
                  <p className="text-zinc-400 text-xs">Fraud, scams, phishing, malware distribution, child sexual abuse material (CSAM), non-consensual sexual content, or illegal transactions.</p>
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-200 text-xs uppercase tracking-wider">Platform Abuse</h4>
                  <p className="text-zinc-400 text-xs">Spam, automated bots, circumventing bans, evading enforcement, or attempting to disrupt platform operations.</p>
                </div>
              </div>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">7. User Content</h2>
              <p>
                Users retain ownership of content they submit. By posting content on Veilo, you grant Veilo a worldwide, non-exclusive, sublicensable license to store, display, process, moderate, and distribute content solely for operating the platform. Users are solely responsible for their content and interactions.
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">8. Reporting & Moderation</h2>
              <p>
                Users may report messages, images, groups, profiles, or violations of these Terms. Veilo may review reported content, remove content, restrict features, or suspend/permanently ban accounts. Moderation decisions are made at Veilo&apos;s sole discretion.
              </p>
            </section>

            {/* Section 9 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">9. Account Suspension & Termination</h2>
              <p>
                Veilo may suspend or terminate accounts for violating these Terms, repeated reports of misconduct, fraudulent activity, security concerns, platform abuse, or legal requirements. Termination may occur without prior notice when necessary to protect users or the platform.
              </p>
            </section>

            {/* Section 10 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">10. Intellectual Property</h2>
              <p>
                All Veilo branding, software, designs, logos, and platform materials remain the property of Veilo or its licensors. Users may not copy platform code, reverse engineer systems, reproduce branding, or use Veilo intellectual property without permission.
              </p>
            </section>

            {/* Section 11 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">11. Service Availability</h2>
              <p>
                Veilo is provided on an &quot;as available&quot; basis. We do not guarantee continuous availability, error-free operation, uninterrupted service, or permanent storage of content. Features may be modified, suspended, or removed at any time.
              </p>
            </section>

            {/* Section 12 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">12. Disclaimer of Warranties</h2>
              <p>
                To the fullest extent permitted by law, Veilo provides services without warranties of any kind, whether express or implied. We do not guarantee the accuracy of user content, reliability of user interactions, or suitability for any particular purpose. Use of the platform is at your own risk.
              </p>
            </section>

            {/* Section 13 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">13. Limitation of Liability</h2>
              <p>
                To the maximum extent permitted by law, Veilo and its operators shall not be liable for indirect, consequential, or special damages, loss of data, loss of profits, service interruptions, or user-generated content. Our total liability shall not exceed the amount paid by you to Veilo during the preceding twelve months, if any.
              </p>
            </section>

            {/* Section 14 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">14. Privacy</h2>
              <p>
                Your use of Veilo is also governed by our Privacy Policy. The Privacy Policy explains what information we collect, how information is used, how anonymity is protected, and your rights regarding personal data.
              </p>
            </section>

            {/* Section 15 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">15. Changes to These Terms</h2>
              <p>
                Veilo may update these Terms periodically. Changes become effective upon publication. Continued use of the platform after changes become effective constitutes acceptance of the revised Terms.
              </p>
            </section>

            {/* Section 16 */}
            <section className="space-y-3">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">16. Governing Law</h2>
              <p>
                These Terms shall be governed by and interpreted under the laws of India, without regard to conflict-of-law principles. Any disputes arising from these Terms shall be subject to the exclusive jurisdiction of the courts located in Aligarh, India.
              </p>
            </section>

            {/* Section 17 */}
            <section className="space-y-3 pb-4">
              <h2 className="font-hanken text-lg font-bold text-[#00F0A0]">17. Contact</h2>
              <p>
                Questions regarding these Terms may be directed to: <br />
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
