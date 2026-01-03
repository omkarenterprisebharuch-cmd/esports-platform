import Link from "next/link";

export default function HallOfFamePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🏅</div>
        <h1 className="text-4xl font-bold text-white mb-4">Hall of Fame</h1>
        <p className="text-xl text-gray-400 mb-8">
          Coming Soon
        </p>
        <p className="text-gray-500 mb-8">
          We&apos;re building an epic Hall of Fame to celebrate our top champions. Check back soon!
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
