import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-brown-900 text-brown-100 py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12">
          {/* Brand Column */}
          <div className="space-y-4">
            <Link href="/" className="text-2xl font-bold text-white">
              Field<span className="text-crimson-violet-400">Ops</span>
            </Link>
            <p className="text-sm text-brown-300 leading-relaxed">
              Bringing order to project chaos. Keep all your project data in one place, build a historical footprint and keep your team on the same page.
            </p>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-white font-bold mb-6">Company</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <Link href="/" className="hover:text-crimson-violet-400 transition-colors">Home</Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-crimson-violet-400 transition-colors">About Us</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-crimson-violet-400 transition-colors">Pricing</Link>
              </li>
            </ul>
          </div>

          {/* Features Links */}
          <div>
            <h4 className="text-white font-bold mb-6">Features</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <Link href="/features/all-in-one-place" className="hover:text-crimson-violet-400 transition-colors">All in One Place</Link>
              </li>
              <li>
                <Link href="/features/historical-records" className="hover:text-crimson-violet-400 transition-colors">Historical Records</Link>
              </li>
              <li>
                <Link href="/features/communication" className="hover:text-crimson-violet-400 transition-colors">Team Communication</Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="text-white font-bold mb-6">Legal</h4>
            <ul className="space-y-4 text-sm">
              <li>
                <Link href="/privacy" className="hover:text-crimson-violet-400 transition-colors">Privacy Policy</Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-crimson-violet-400 transition-colors">Terms of Service</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-brown-800 mt-12 pt-8 text-center text-sm text-brown-400">
          <p>&copy; {new Date().getFullYear()} FieldOps. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;