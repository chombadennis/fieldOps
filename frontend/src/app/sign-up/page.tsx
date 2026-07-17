import Link from 'next/link';

export default function SignUpPlaceholder() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 font-inter flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative background glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-crimson-violet-100 blur-[120px] opacity-60 pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-princeton-orange-100 blur-[120px] opacity-60 pointer-events-none" />

      <div className="max-w-md w-full text-center z-10 bg-white/70 backdrop-blur-md border border-gray-150/50 p-10 rounded-3xl shadow-xl">
        <div className="w-20 h-20 bg-crimson-violet-50 text-crimson-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h1 className="text-3xl font-extrabold mb-4 font-lexend tracking-tight">
          Authentication <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-crimson-violet-600 to-princeton-orange-500">
            Coming Soon
          </span>
        </h1>

        <p className="text-gray-600 mb-8 text-sm leading-relaxed">
          Multi-tenant user registration and team permissions are currently under construction during this active BOQ & IPC phase.
        </p>

        <div className="space-y-3">
          <Link
            href="/dashboard"
            className="block w-full bg-crimson-violet-600 hover:bg-crimson-violet-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all transform hover:-translate-y-0.5 shadow-lg shadow-crimson-violet-200"
          >
            Go to Project Dashboard
          </Link>
          
          <Link
            href="/"
            className="block w-full bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3.5 px-6 rounded-xl transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
