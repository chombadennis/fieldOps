'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, Lock, Mail, User, ShieldCheck, ArrowRight } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push('/dashboard');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="flex justify-center items-center space-x-3">
          <div className="p-3 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-2xl shadow-lg shadow-purple-500/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <span className="text-2xl font-black text-white tracking-tight">FieldOps</span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Create Company Workspace</h2>
        <p className="mt-2 text-center text-xs text-slate-400">
          Get started with collaborative construction project & financial management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md z-10">
        <div className="bg-slate-900/80 backdrop-blur-xl py-8 px-6 shadow-2xl rounded-3xl border border-slate-800 sm:px-10">
          
          {/* Quick Demo Bypass Banner */}
          <div className="mb-6 p-4 rounded-2xl bg-purple-950/60 border border-purple-700/50 text-center">
            <p className="text-xs font-semibold text-purple-200 mb-2">Auth in Demo Mode</p>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-[0.98]"
            >
              Enter Demo Dashboard &rarr;
            </Link>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization Name</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Building2 className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Apex Construction Ltd"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Your Full Name</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  placeholder="Dennis Chomba"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Work Email</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  type="email"
                  required
                  placeholder="dennis@apexconstruction.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
              <div className="relative rounded-2xl">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type="password"
                  required
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-4 py-3 bg-slate-800/80 border border-slate-700/80 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-3.5 px-4 border border-transparent rounded-2xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition active:scale-[0.98] mt-2"
            >
              {loading ? 'Creating Account...' : 'Get Started Free'} <ArrowRight className="ml-2 w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-400">
              Already have an account?{' '}
              <Link href="/login" className="font-semibold text-purple-400 hover:text-purple-300">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-slate-500 flex items-center justify-center space-x-1">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Role-Based Access & Encrypted Storage</span>
        </div>
      </div>
    </div>
  );
}
