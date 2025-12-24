"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("OTP sent to your email");
        setStep("otp");
      } else {
        setError(data.message);
      }
    } catch {
      setError("Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, new_password: password }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess("Password reset successful! Redirecting to login...");
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      } else {
        setError(data.message);
      }
    } catch {
      setError("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Reset Password</h1>
          <p className="mt-2 text-gray-600">
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "otp" && "Enter the OTP sent to your email"}
          </p>
        </div>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-green-600 text-sm">
            {success}
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleSendOTP} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyAndReset} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OTP Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                required
                maxLength={6}
                placeholder="Enter 6-digit OTP"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent text-center text-2xl tracking-widest"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Enter new password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Confirm new password"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition disabled:opacity-50"
            >
              {loading ? "Resetting..." : "Reset Password"}
            </button>

            <button
              type="button"
              onClick={() => setStep("email")}
              className="w-full py-3 text-gray-600 hover:text-gray-900 transition"
            >
              Back to Email
            </button>
          </form>
        )}

        <div className="text-center">
          <Link
            href="/login"
            className="text-gray-600 hover:text-gray-900 text-sm"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
