"use client";

import Link from "next/link";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Terms of Service
          </h1>
          <p className="text-gray-400 mb-8">
            Last updated: December 30, 2025 | Version 1.0
          </p>

          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-300">
                By accessing or using our Esports Tournament Platform, you agree
                to be bound by these Terms of Service. If you do not agree to
                these terms, please do not use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Eligibility
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>You must be at least 13 years old to use this platform</li>
                <li>
                  Users under 18 must have parental or guardian consent
                </li>
                <li>
                  You must provide accurate and complete registration information
                </li>
                <li>
                  You are responsible for maintaining the security of your account
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. Account Responsibilities
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  You are responsible for all activities under your account
                </li>
                <li>
                  You must not share your account credentials with others
                </li>
                <li>
                  You must notify us immediately of any unauthorized access
                </li>
                <li>
                  One account per person; multiple accounts are not permitted
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Tournament Participation
              </h2>
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                4.1 Registration
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Registration fees are non-refundable unless the tournament is
                  cancelled
                </li>
                <li>
                  You must provide accurate in-game IDs for verification
                </li>
                <li>
                  Late registrations may not be accepted after the deadline
                </li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                4.2 Fair Play
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Cheating, hacking, or exploiting bugs is strictly prohibited
                </li>
                <li>
                  Match fixing or collusion will result in permanent bans
                </li>
                <li>
                  Players must respect opponents, organizers, and staff
                </li>
                <li>
                  Unsportsmanlike conduct may result in disqualification
                </li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                4.3 Teams
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Team captains are responsible for their team members&apos; conduct
                </li>
                <li>
                  Roster changes must comply with tournament rules
                </li>
                <li>
                  Teams must be ready at the scheduled match time
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Prize Distribution
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Prizes are distributed according to tournament-specific rules
                </li>
                <li>
                  Winners must verify their identity before receiving prizes
                </li>
                <li>
                  Prizes may be subject to applicable taxes
                </li>
                <li>
                  Disqualified players/teams forfeit their prize eligibility
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Prohibited Conduct
              </h2>
              <p className="text-gray-300">Users must not:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>
                  Use offensive, discriminatory, or inappropriate usernames or
                  content
                </li>
                <li>Harass, threaten, or abuse other users</li>
                <li>
                  Impersonate others or provide false information
                </li>
                <li>
                  Attempt to hack, exploit, or compromise platform security
                </li>
                <li>
                  Use automated bots or scripts without authorization
                </li>
                <li>
                  Engage in spamming, phishing, or fraudulent activities
                </li>
                <li>
                  Violate any applicable laws or regulations
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Content and Communication
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  You retain ownership of content you submit, but grant us a
                  license to use it
                </li>
                <li>
                  We may moderate or remove content that violates our policies
                </li>
                <li>
                  Chat messages and communications may be monitored for safety
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. Intellectual Property
              </h2>
              <p className="text-gray-300">
                All platform content, including logos, designs, and software, is
                owned by us or our licensors. You may not copy, modify, or
                distribute our intellectual property without permission.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. Account Suspension and Termination
              </h2>
              <p className="text-gray-300">We may suspend or terminate accounts for:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>Violation of these Terms of Service</li>
                <li>Fraudulent or illegal activity</li>
                <li>Cheating or unsportsmanlike conduct</li>
                <li>Extended inactivity</li>
              </ul>
              <p className="text-gray-300 mt-2">
                You may delete your account at any time through your profile
                settings.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Disclaimers
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  The platform is provided &quot;as is&quot; without warranties
                </li>
                <li>
                  We do not guarantee uninterrupted or error-free service
                </li>
                <li>
                  We are not responsible for third-party game service issues
                </li>
                <li>
                  Tournament results and prize distribution are final
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                11. Limitation of Liability
              </h2>
              <p className="text-gray-300">
                To the maximum extent permitted by law, we shall not be liable
                for any indirect, incidental, special, consequential, or punitive
                damages arising from your use of the platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                12. Dispute Resolution
              </h2>
              <p className="text-gray-300">
                Any disputes arising from these terms shall be resolved through
                good faith negotiation. If unresolved, disputes shall be settled
                through binding arbitration in accordance with applicable laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                13. Changes to Terms
              </h2>
              <p className="text-gray-300">
                We reserve the right to modify these Terms of Service at any
                time. We will notify users of significant changes via email or
                platform notification. Continued use of the platform after
                changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                14. Contact Information
              </h2>
              <p className="text-gray-300">
                For questions about these Terms of Service, please contact us at:
              </p>
              <p className="text-gray-300 mt-2">
                Email: support@example.com
                <br />
                Address: [Your Company Address]
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700 flex justify-between">
            <Link
              href="/"
              className="text-orange-500 hover:text-orange-400 transition-colors"
            >
              ← Back to Home
            </Link>
            <Link
              href="/privacy-policy"
              className="text-orange-500 hover:text-orange-400 transition-colors"
            >
              Privacy Policy →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
