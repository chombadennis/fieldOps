import React from 'react';
import Link from 'next/link';

const Navpanel = () => {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-2xl font-bold tracking-tight text-crimson-violet-600">
              Field<span className="text-dark-teal-600">Ops</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-sm font-medium text-gray-600 hover:text-crimson-violet-600 transition-colors">
              Home
            </Link>
            <Link href="#features" className="text-sm font-medium text-gray-600 hover:text-crimson-violet-600 transition-colors">
              Features
            </Link>
            <Link href="#about" className="text-sm font-medium text-gray-600 hover:text-crimson-violet-600 transition-colors">
              About
            </Link>
            <Link href="#contact" className="text-sm font-medium text-gray-600 hover:text-crimson-violet-600 transition-colors">
              Contact
            </Link>
          </div>

          {/* CTA Button */}
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard" 
              className="hidden sm:inline-block text-sm font-medium text-gray-600 hover:text-crimson-violet-600 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-crimson-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-crimson-violet-700 hover:shadow-lg transition-all active:scale-95"
            >
              Get Started
            </Link>
            
            {/* Mobile Menu Toggle (Simplified) */}
            <button className="md:hidden text-gray-600 p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navpanel;