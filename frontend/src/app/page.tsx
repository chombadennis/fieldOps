import Link from 'next/link';
import Image from 'next/image';
import Navpanel from '@/components/Navpanel';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 selection:bg-crimson-violet-100 font-inter">
      <Navpanel />

      {/* Hero Section */}
      <header className="container mx-auto px-6 py-24 md:py-32 text-center animate-fade-in-up">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-6 tracking-tight font-lexend">
          Streamline Your <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-crimson-violet-600 via-deep-crimson-500 to-princeton-orange-500">
            Construction Projects
          </span>
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          The all-in-one platform for modern builders. Manage bids, track progress, and coordinate teams with precision and ease.
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
          <Link href="/sign-up" className="w-full sm:w-auto bg-crimson-violet-600 text-white font-bold py-4 px-10 rounded-xl hover:bg-crimson-violet-700 transition-all transform hover:-translate-y-1 shadow-xl">
            Get Started
          </Link>
          <Link href="#how-it-works" className="w-full sm:w-auto bg-white border-2 border-dark-teal-600 text-dark-teal-600 font-bold py-4 px-10 rounded-xl hover:bg-dark-teal-50 transition-all">
            See How It Works
          </Link>
        </div>
      </header>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-3xl font-bold mb-4 font-lexend">Key Features</h2>
            <div className="h-1.5 w-20 bg-deep-crimson-500 mx-auto rounded-full"></div>
            <p className="mt-6 text-gray-500 max-w-xl mx-auto text-base">Everything you need to move from blueprint to ribbon-cutting in record time.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="group p-8 bg-[#fcfcfc] border border-gray-100 rounded-3xl hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-16 h-16 bg-crimson-violet-50 rounded-2xl flex items-center justify-center mb-6 animate-float">
                  <Image src="/file.svg" alt="Bidding" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-crimson-violet-600 transition-colors font-lexend">Simplified Bidding</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Create and manage bids with ease. Our AI-assisted parser extracts item details instantly, giving you real-time insights into your costs.</p>
            </div>
            <div className="group p-8 bg-[#fcfcfc] border border-gray-100 rounded-3xl hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-16 h-16 bg-dark-teal-50 rounded-2xl flex items-center justify-center mb-6 animate-float" style={{ animationDelay: '0.5s' }}>
                  <Image src="/window.svg" alt="Project Management" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-dark-teal-600 transition-colors font-lexend">Dynamic Scheduling</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Track progress against milestones. Manage labor and equipment resources with a visual interface designed for the field.</p>
            </div>
            <div className="group p-8 bg-[#fcfcfc] border border-gray-100 rounded-3xl hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-16 h-16 bg-princeton-orange-50 rounded-2xl flex items-center justify-center mb-6 animate-float" style={{ animationDelay: '1s' }}>
                  <Image src="/globe.svg" alt="Real-time Analytics" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-princeton-orange-600 transition-colors font-lexend">Real-time Analytics</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Make data-driven decisions. High-level dashboards provide insights into project health, budget variances, and team performance.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-dark-teal-900 text-white">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-16">
            <div className="md:w-1/2">
              <h2 className="text-3xl font-bold mb-8 font-lexend">How FieldOps Works</h2>
              <div className="space-y-8">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-dark-teal-500 rounded-full flex items-center justify-center font-bold">1</div>
                  <div>
                    <h4 className="text-lg font-bold mb-2 font-lexend">Upload your BOQ</h4>
                    <p className="text-dark-teal-100 text-sm">Drop your Excel files into our system. Our AI maps columns and extracts items automatically.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-dark-teal-500 rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h4 className="text-lg font-bold mb-2 font-lexend">Track Daily Progress</h4>
                    <p className="text-dark-teal-100 text-sm">Input daily accomplishments directly from the site. Photos and logs sync instantly.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-dark-teal-500 rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h4 className="text-lg font-bold mb-2 font-lexend">Generate Reports</h4>
                    <p className="text-dark-teal-100 text-sm">One-click generation of progress reports, cost analysis, and billing documents.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 bg-dark-teal-800 p-4 rounded-3xl shadow-2xl">
              <div className="bg-white rounded-2xl overflow-hidden aspect-video relative flex items-center justify-center text-dark-teal-900">
                <span className="font-bold">[ Dashboard Preview Image ]</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 font-lexend">Built by Builders, for Builders</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              We started FieldOps because we were tired of managing million-dollar projects with messy spreadsheets and paper logs. 
              Our mission is to bring digital transformation to the construction site, empowering project managers and site engineers with tools that actually work.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-crimson-violet-600 to-deep-crimson-700 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="container mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 font-lexend">Ready to take control of your projects?</h2>
          <p className="text-lg text-crimson-violet-50 mb-10 max-w-2xl mx-auto">
            Join hundreds of construction firms scaling their operations with FieldOps.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link href="/sign-up" className="bg-white text-crimson-violet-600 font-bold py-4 px-10 rounded-xl hover:bg-gray-100 transition-colors shadow-lg">
              Start Free Trial
            </Link>
            <Link href="#" className="border-2 border-white/30 hover:bg-white/10 text-white font-bold py-4 px-10 rounded-xl transition-colors">
              Contact Sales
            </Link>
          </div>
          <p className="mt-8 text-crimson-violet-200 text-sm">No credit card required • 14-day free trial • Cancel anytime</p>
        </div>
      </section>

      <Footer />
    </div>
  );
}