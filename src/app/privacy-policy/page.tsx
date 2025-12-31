import Link from "next/link";
import { Metadata } from "next";

// Static page - no dynamic data needed
export const dynamic = "force-static";
export const revalidate = false; // Never revalidate - fully static

export const metadata: Metadata = {
  title: "Privacy Policy | Esports Platform",
  description: "Learn how we collect, use, and protect your personal data on our esports tournament platform.",
  openGraph: {
    title: "Privacy Policy | Esports Platform",
    description: "Learn how we collect, use, and protect your personal data.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400 mb-8">
            Last updated: December 30, 2025 | Version 1.0
          </p>

          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Introduction
              </h2>
              <p className="text-gray-300">
                Welcome to our Esports Tournament Platform. We are committed to
                protecting your personal data and respecting your privacy. This
                Privacy Policy explains how we collect, use, disclose, and
                safeguard your information when you use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Information We Collect
              </h2>
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                2.1 Personal Information
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Account information: username, email address, password (hashed)
                </li>
                <li>Profile information: full name, phone number, profile picture</li>
                <li>Gaming information: in-game IDs for various games</li>
                <li>Payment information: wallet balance, transaction history</li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                2.2 Automatically Collected Information
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>IP address and device information</li>
                <li>Browser type and version</li>
                <li>Login history and session data</li>
                <li>Usage patterns and preferences</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. How We Use Your Information
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>To create and manage your account</li>
                <li>To process tournament registrations and team management</li>
                <li>To facilitate communication between players and organizers</li>
                <li>To send notifications about tournaments and platform updates</li>
                <li>To detect and prevent fraud and security threats</li>
                <li>To improve our platform and user experience</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Data Protection
              </h2>
              <p className="text-gray-300">
                We implement industry-standard security measures to protect your
                personal data:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>AES-256 encryption for sensitive data at rest</li>
                <li>Secure HTTPS connections for all data transmission</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication mechanisms</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Data Sharing
              </h2>
              <p className="text-gray-300">
                We do not sell your personal data. We may share your information
                with:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>Tournament organizers (for registration purposes)</li>
                <li>Team members (game IDs for team coordination)</li>
                <li>Service providers who assist our operations</li>
                <li>Legal authorities when required by law</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Your Rights (GDPR)
              </h2>
              <p className="text-gray-300">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>
                  <strong>Access:</strong> Request a copy of your personal data
                </li>
                <li>
                  <strong>Rectification:</strong> Correct inaccurate personal data
                </li>
                <li>
                  <strong>Erasure:</strong> Request deletion of your account and
                  data
                </li>
                <li>
                  <strong>Restriction:</strong> Request limitation of processing
                </li>
                <li>
                  <strong>Portability:</strong> Receive your data in a portable
                  format
                </li>
                <li>
                  <strong>Object:</strong> Object to processing of your data
                </li>
              </ul>
              <p className="text-gray-300 mt-4">
                To exercise these rights, please visit your{" "}
                <Link href="/profile" className="text-orange-500 hover:underline">
                  profile settings
                </Link>{" "}
                or contact us at privacy@example.com.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Account Deletion
              </h2>
              <p className="text-gray-300">
                You may request account deletion at any time through your profile
                settings. Upon request:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>A 30-day grace period allows you to cancel the deletion</li>
                <li>After 30 days, your data will be permanently anonymized</li>
                <li>Some data may be retained for legal compliance purposes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. Cookies and Tracking
              </h2>
              <p className="text-gray-300">
                We use essential cookies for authentication and security. We do
                not use third-party tracking cookies for advertising purposes.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. Data Retention
              </h2>
              <p className="text-gray-300">
                We retain your personal data for as long as your account is
                active. After account deletion, data is anonymized within 30
                days. Transaction records may be retained for up to 7 years for
                legal compliance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Changes to This Policy
              </h2>
              <p className="text-gray-300">
                We may update this Privacy Policy from time to time. We will
                notify you of significant changes via email or platform
                notification. Continued use of the platform after changes
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                11. Contact Us
              </h2>
              <p className="text-gray-300">
                If you have questions about this Privacy Policy or your personal
                data, please contact us at:
              </p>
              <p className="text-gray-300 mt-2">
                Email: privacy@example.com
                <br />
                Address: [Your Company Address]
              </p>
            </section>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-700">
            <Link
              href="/"
              className="text-orange-500 hover:text-orange-400 transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
