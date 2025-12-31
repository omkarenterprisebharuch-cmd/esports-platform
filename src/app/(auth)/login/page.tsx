"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader } from "@/components/ui/Loader";
import { ApiErrorDisplay, type ApiErrorInfo } from "@/components/ui/ApiErrorDisplay";
import { secureFetch, setCachedUser } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", remember_me: false });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiErrorInfo | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await secureFetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(form),
        skipCsrf: true, // Login doesn't need CSRF (no auth yet)
      });

      const data = await res.json();

      if (!res.ok) {
        setError({
          message: data.message || "Login failed",
          errorCode: data.errorCode,
        });
        return;
      }

      // Cache user data for UI (non-sensitive)
      setCachedUser(data.data.user);

      // Clear any old localStorage tokens (cleanup)
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Initialize session activity tracking
      localStorage.setItem("last_activity_timestamp", Date.now().toString());
      localStorage.setItem("session_active", "true");

      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError({
        message: err instanceof Error ? err.message : "Login failed",
        errorCode: "SRV_9001",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      {/* Show blob loader overlay during login */}
      {isLoading && <Loader message="Signing you in..." />}
      
      <div className="w-full max-w-md">
        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome Back
            </h1>
            <p className="text-gray-600">Sign in to your account</p>
          </div>

          {error && (
            <ApiErrorDisplay 
              error={error} 
              onDismiss={() => setError(null)}
              className="mb-6"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                placeholder="Enter your email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-gray-900 text-base bg-white placeholder:text-gray-400"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-transparent outline-none transition text-gray-900 text-base bg-white placeholder:text-gray-400"
                required
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.remember_me}
                  onChange={(e) => setForm({ ...form, remember_me: e.target.checked })}
                  className="w-4 h-4 mr-2 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">Remember me for 30 days</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-gray-900 hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sign In
            </button>
          </form>

          <p className="text-center mt-6 text-gray-600">
            Don't have an account?{" "}
            <Link
              href="/register"
              className="font-semibold text-gray-900 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
