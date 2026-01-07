"use client";

import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-800 border-t border-gray-700">
      {/* Mobile Compact Footer */}
      <div className="md:hidden px-4 py-4">
        <div className="flex flex-col items-center gap-3">
          <h3 className="text-base font-bold text-white">Nova Tourney</h3>
          
          {/* Quick Links Row */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link href="/tournaments" className="text-gray-400 hover:text-orange-500 text-xs">
              Tournaments
            </Link>
            <Link href="/contact" className="text-gray-400 hover:text-orange-500 text-xs">
              Contact
            </Link>
            <Link href="/terms" className="text-gray-400 hover:text-orange-500 text-xs">
              Terms
            </Link>
            <Link href="/privacy-policy" className="text-gray-400 hover:text-orange-500 text-xs">
              Privacy
            </Link>
            <Link href="/refund-policy" className="text-gray-400 hover:text-orange-500 text-xs">
              Refunds
            </Link>
          </div>
          
          {/* Contact Info */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-gray-500">
            <a href="mailto:support@novatourney.online" className="hover:text-orange-500">
              📧 support@novatourney.online
            </a>
          </div>
          
          {/* Copyright */}
          <p className="text-gray-500 text-xs">
            © {currentYear} Nova Tourney
          </p>
        </div>
      </div>

      {/* Tablet & Desktop Full Footer */}
      <div className="hidden md:block max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-white">Nova Tourney</h3>
            <p className="text-gray-400 text-sm">
              Your ultimate destination for competitive gaming tournaments.
              Join, compete, and rise to glory!
            </p>
            <p className="text-gray-500 text-xs">
              📍 Surat, Gujarat
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

          {/* Contact Us */}
          <div className="space-y-4">
            <h4 className="text-md font-semibold text-white">Contact Us</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <span className="text-orange-500">📧</span>
                <a
                  href="mailto:support@novatourney.online"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  support@novatourney.online
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">📱</span>
                <a
                  href="tel:+919876543210"
                  className="text-gray-400 hover:text-orange-500 transition-colors text-sm"
                >
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-orange-500">⏰</span>
                <span className="text-gray-400 text-sm">
                  Mon - Sat: 10AM - 8PM
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-gray-400 text-sm text-center md:text-left">
              © {currentYear} Nova Tourney. All rights reserved.
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
