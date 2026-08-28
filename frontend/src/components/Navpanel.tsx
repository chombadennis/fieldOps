"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Dialog, DialogPanel } from "@headlessui/react";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const navigation = [
  { name: "Product", href: "#" },
  { name: "Features", href: "#features" },
  { name: "Marketplace", href: "#" },
  { name: "Company", href: "#" },
];

export default function Navpanel() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-black/20 backdrop-blur-xl border-b border-white/10">
      <nav
        aria-label="Global"
        className="mx-auto flex max-w-7xl items-center justify-between p-4 lg:px-8"
      >
        <div className="flex lg:flex-1 items-center space-x-2">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
            <span className="sr-only">FieldOps</span>
            <Image src="/favicon.ico" alt="FieldOps Logo" width={48} height={48} className="w-12 h-12 drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]" />
            <span className="text-xl font-bold font-lexend text-white drop-shadow-md hidden sm:block">FieldOps</span>
          </Link>
        </div>
        <div className="flex lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-white hover:text-neon-cyan transition-colors"
          >
            <span className="sr-only">Open main menu</span>
            <Bars3Icon aria-hidden="true" className="h-6 w-6" />
          </button>
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          {navigation.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-base font-semibold leading-6 text-gray-300 hover:text-white hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all"
            >
              {item.name}
            </a>
          ))}
        </div>
        <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:space-x-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-5 py-2.5 bg-white/5 text-neon-cyan hover:bg-neon-cyan/10 hover:shadow-[0_0_15px_rgba(0,243,255,0.3)] font-bold rounded-lg text-sm border border-neon-cyan/30 hover:border-neon-cyan transition-all"
          >
            Demo Dashboard
          </Link>
          <Link
            href="/login"
            className="text-sm font-semibold leading-6 text-gray-300 hover:text-white px-2 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="relative group inline-flex items-center"
          >
            <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-lg blur opacity-70 group-hover:opacity-100 transition duration-500"></div>
            <div className="relative px-5 py-2.5 bg-black hover:bg-black/80 text-white font-bold rounded-lg text-sm border border-white/20 transition-all">
              Sign Up <span aria-hidden="true" className="ml-1">&rarr;</span>
            </div>
          </Link>
        </div>
      </nav>
      <Dialog
        open={mobileMenuOpen}
        onClose={setMobileMenuOpen}
        className="lg:hidden"
      >
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-[#030305]/95 backdrop-blur-xl border-l border-white/10 px-6 py-6 sm:max-w-sm">
          <div className="flex items-center justify-between">
            <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
              <span className="sr-only">FieldOps</span>
              <Image src="/favicon.ico" alt="FieldOps Logo" width={48} height={48} className="w-12 h-12 drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]" />
              <span className="text-xl font-bold font-lexend text-white">FieldOps</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="-m-2.5 rounded-md p-2.5 text-gray-400 hover:text-white transition-colors"
            >
              <span className="sr-only">Close menu</span>
              <XMarkIcon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
          <div className="mt-6 flow-root">
            <div className="-my-6 divide-y divide-white/10">
              <div className="space-y-2 py-6">
                {navigation.map((item) => (
                  <a
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold leading-7 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    {item.name}
                  </a>
                ))}
              </div>
              <div className="py-6 space-y-4">
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
                >
                  Demo Dashboard
                </Link>
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-gray-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/sign-up"
                  onClick={() => setMobileMenuOpen(false)}
                  className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-bold leading-7 text-white bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Sign Up
                </Link>
              </div>
            </div>
          </div>
        </DialogPanel>
      </Dialog>
    </header>
  );
}
