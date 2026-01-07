import Link from "next/link";
import { Metadata } from "next";

// Static page - no dynamic data needed
export const dynamic = "force-static";
export const revalidate = false; // Never revalidate - fully static

export const metadata: Metadata = {
  title: "Refund and Cancellation Policy | Esports Platform",
  description: "Understand our refund and cancellation policies for tournament registrations and wallet transactions.",
  openGraph: {
    title: "Refund and Cancellation Policy | Esports Platform",
    description: "Refund and cancellation policies for esports tournaments.",
    type: "website",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Refund and Cancellation Policy
          </h1>
          <p className="text-gray-400 mb-8">
            Last updated: January 7, 2026 | Version 1.0
          </p>

          <div className="prose prose-invert max-w-none space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                1. Overview
              </h2>
              <p className="text-gray-300">
                This Refund and Cancellation Policy outlines the terms and
                conditions under which refunds may be issued for tournament
                registrations, wallet transactions, and other services on our
                Esports Platform.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                2. Tournament Registration Refunds
              </h2>
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                2.1 Eligible for Refund
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Tournament cancelled by organizers before the start date
                </li>
                <li>
                  Technical issues on our platform preventing participation
                </li>
                <li>
                  Double registration due to payment processing errors
                </li>
                <li>
                  Cancellation request made at least 24 hours before tournament
                  start
                </li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                2.2 Not Eligible for Refund
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Cancellation request made less than 24 hours before tournament
                  start
                </li>
                <li>Player disqualification due to rule violations</li>
                <li>No-show or failure to check-in on time</li>
                <li>
                  Issues on the player&apos;s end (internet, device, game account)
                </li>
                <li>Change of mind after registration confirmation</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                3. Wallet and Payment Refunds
              </h2>
              <h3 className="text-lg font-medium text-gray-200 mb-2">
                3.1 Wallet Deposits
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Deposits are generally non-refundable once credited to wallet
                </li>
                <li>
                  Failed transactions where amount was debited but not credited
                  will be refunded within 5-7 business days
                </li>
                <li>
                  Duplicate payments will be refunded to the original payment
                  method
                </li>
              </ul>

              <h3 className="text-lg font-medium text-gray-200 mb-2 mt-4">
                3.2 Prize Withdrawals
              </h3>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>
                  Withdrawal requests cannot be cancelled once submitted
                </li>
                <li>Processing time: 3-7 business days</li>
                <li>
                  Failed withdrawals will be credited back to your wallet
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                4. Refund Process
              </h2>
              <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                <h3 className="text-lg font-medium text-white mb-3">
                  Steps to Request a Refund:
                </h3>
                <ol className="list-decimal list-inside text-gray-300 space-y-2">
                  <li>
                    Contact our support team at support@esportsplatform.com
                  </li>
                  <li>
                    Provide your username, registered email, and transaction
                    details
                  </li>
                  <li>Explain the reason for your refund request</li>
                  <li>
                    Include any relevant screenshots or proof if applicable
                  </li>
                  <li>Wait for our team to review and respond within 48 hours</li>
                </ol>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                5. Refund Timeframes
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="py-3 px-4 text-gray-200">Refund Type</th>
                      <th className="py-3 px-4 text-gray-200">Processing Time</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    <tr className="border-b border-gray-700">
                      <td className="py-3 px-4">Tournament Cancellation</td>
                      <td className="py-3 px-4">1-3 business days (to wallet)</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-3 px-4">Failed Transaction</td>
                      <td className="py-3 px-4">5-7 business days</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-3 px-4">Duplicate Payment</td>
                      <td className="py-3 px-4">5-7 business days</td>
                    </tr>
                    <tr className="border-b border-gray-700">
                      <td className="py-3 px-4">Bank/UPI Refund</td>
                      <td className="py-3 px-4">7-10 business days</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                6. Cancellation by Platform
              </h2>
              <p className="text-gray-300 mb-3">
                We reserve the right to cancel tournaments or registrations under
                the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Insufficient registrations to proceed with tournament</li>
                <li>Technical issues affecting fair gameplay</li>
                <li>Violation of our terms of service</li>
                <li>Suspected fraudulent activity</li>
                <li>Force majeure events</li>
              </ul>
              <p className="text-gray-300 mt-3">
                In case of platform-initiated cancellations, full refunds will be
                processed to the player&apos;s wallet within 1-3 business days.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                7. Partial Refunds
              </h2>
              <p className="text-gray-300">
                In certain situations, partial refunds may be issued:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1 mt-2">
                <li>
                  Tournament format changed significantly after registration
                </li>
                <li>
                  Reduced prize pool due to lower participation (proportional
                  refund)
                </li>
                <li>
                  Platform errors causing partial disruption of tournament
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                8. Non-Refundable Items
              </h2>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Promotional credits or bonus amounts</li>
                <li>Cashback rewards</li>
                <li>Referral bonuses</li>
                <li>Free entry passes or vouchers</li>
                <li>Administrative or processing fees (if applicable)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                9. Dispute Resolution
              </h2>
              <p className="text-gray-300">
                If you disagree with our refund decision, you may escalate the
                matter by:
              </p>
              <ol className="list-decimal list-inside text-gray-300 space-y-1 mt-2">
                <li>
                  Replying to the support email with additional information
                </li>
                <li>Requesting a review by our senior support team</li>
                <li>
                  Contacting us through our official social media channels
                </li>
              </ol>
              <p className="text-gray-300 mt-3">
                We aim to resolve all disputes within 7 business days of
                escalation.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                10. Contact for Refunds
              </h2>
              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-gray-300">
                  <strong>Email:</strong> support@esportsplatform.com
                </p>
                <p className="text-gray-300 mt-2">
                  <strong>Subject Line:</strong> Refund Request - [Your Username]
                </p>
                <p className="text-gray-400 text-sm mt-3">
                  Please include your transaction ID and registered email in all
                  refund-related communications.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-3">
                11. Policy Updates
              </h2>
              <p className="text-gray-300">
                We may update this Refund and Cancellation Policy from time to
                time. Any changes will be posted on this page with an updated
                revision date. We encourage you to review this policy
                periodically.
              </p>
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
