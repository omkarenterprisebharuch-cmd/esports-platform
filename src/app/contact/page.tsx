import Link from "next/link";
import { Metadata } from "next";

// Static page - no dynamic data needed
export const dynamic = "force-static";
export const revalidate = false; // Never revalidate - fully static

export const metadata: Metadata = {
  title: "Contact Us | Esports Platform",
  description: "Get in touch with our support team for any queries about tournaments, accounts, or technical issues.",
  openGraph: {
    title: "Contact Us | Esports Platform",
    description: "Contact our support team for assistance with esports tournaments.",
    type: "website",
  },
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">Contact Us</h1>
          <p className="text-gray-400 mb-8">
            We&apos;re here to help! Reach out to us with any questions or concerns.
          </p>

          <div className="prose prose-invert max-w-none space-y-8">
            {/* Contact Information */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Get in Touch
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-700/50 rounded-lg p-6">
                  <div className="flex items-center mb-3">
                    <svg
                      className="w-6 h-6 text-orange-500 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-white">Email</h3>
                  </div>
                  <p className="text-gray-300">support@esportsplatform.com</p>
                  <p className="text-gray-400 text-sm mt-1">
                    We typically respond within 24 hours
                  </p>
                </div>

                <div className="bg-gray-700/50 rounded-lg p-6">
                  <div className="flex items-center mb-3">
                    <svg
                      className="w-6 h-6 text-orange-500 mr-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <h3 className="text-lg font-medium text-white">
                      Support Hours
                    </h3>
                  </div>
                  <p className="text-gray-300">Monday - Saturday</p>
                  <p className="text-gray-400 text-sm mt-1">
                    10:00 AM - 8:00 PM IST
                  </p>
                </div>
              </div>
            </section>

            {/* Support Categories */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                How Can We Help?
              </h2>
              <div className="space-y-4">
                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">
                    🎮 Tournament Support
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Questions about tournament registration, rules, schedules, or
                    results? Our tournament support team is ready to assist.
                  </p>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">
                    💳 Payment & Wallet
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Issues with deposits, withdrawals, or wallet transactions?
                    Contact us for payment-related assistance.
                  </p>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">
                    👤 Account Issues
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Problems with login, account access, or profile settings?
                    We&apos;ll help you get back on track.
                  </p>
                </div>

                <div className="bg-gray-700/30 rounded-lg p-4">
                  <h3 className="text-lg font-medium text-white mb-2">
                    🐛 Technical Support
                  </h3>
                  <p className="text-gray-300 text-sm">
                    Experiencing bugs or technical issues with the platform?
                    Report them to our technical team.
                  </p>
                </div>
              </div>
            </section>

            {/* Response Time */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Response Times
              </h2>
              <div className="bg-gray-700/50 rounded-lg p-6">
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-3"></span>
                    <span>
                      <strong>Urgent Issues:</strong> Within 4 hours
                    </span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></span>
                    <span>
                      <strong>General Queries:</strong> Within 24 hours
                    </span>
                  </li>
                  <li className="flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-3"></span>
                    <span>
                      <strong>Feature Requests:</strong> Within 48-72 hours
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            {/* Social Links */}
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">
                Follow Us
              </h2>
              <p className="text-gray-300 mb-4">
                Stay connected and get the latest updates on tournaments and
                events.
              </p>
              <div className="flex space-x-4">
                <a
                  href="#"
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <span>Discord</span>
                </a>
                <a
                  href="#"
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <span>Instagram</span>
                </a>
                <a
                  href="#"
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors flex items-center"
                >
                  <span>YouTube</span>
                </a>
              </div>
            </section>
          </div>

          {/* Back to Home Link */}
          <div className="mt-8 pt-6 border-t border-gray-700">
            <Link
              href="/"
              className="inline-flex items-center text-orange-500 hover:text-orange-400 transition-colors"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
