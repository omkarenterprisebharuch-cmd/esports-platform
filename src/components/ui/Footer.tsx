"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 border-t border-gray-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Esports Platform</h3>
            <p className="text-gray-400 text-sm">
              Your ultimate destination for competitive gaming tournaments.
              Join, compete, and rise to glory!
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-white">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/tournaments"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Tournaments
                </Link>
              </li>
              <li>
                <Link
                  href="/leaderboard"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Leaderboard
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-white">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/terms"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Terms and Conditions
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy-policy"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/refund-policy"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  Refund and Cancellation
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              © {currentYear} Esports Platform. All rights reserved.
            </p>
            <div className="flex space-x-6">
              <Link
                href="/contact"
                className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
              >
                Contact Us
              </Link>
              <Link
                href="/terms"
                className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
              >
                Terms
              </Link>
              <Link
                href="/refund-policy"
                className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
              >
                Refunds
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
