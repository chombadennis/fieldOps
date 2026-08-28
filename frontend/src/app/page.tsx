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
        <h1 className="text-4xl md:text-5xl font-extrabold mb-6 tracking-tight font-lexend leading-tight">
          Bring Order To <br />
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-crimson-violet-600 via-deep-crimson-500 to-princeton-orange-500 pb-2 inline-block">
            Project Chaos
          </span>
        </h1>
        <p className="text-lg text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
          Connect scattered data, teams and insights into one unified workspace. Give leadership total visibility, build a historical footprint and keep everyone on the same page from day one to handover.
        </p>
        <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <Link href="/dashboard" className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-bold py-4 px-8 rounded-xl hover:from-indigo-500 hover:to-blue-500 transition-all transform hover:-translate-y-1 shadow-xl flex items-center justify-center">
            Enter Demo Dashboard
          </Link>
          <Link href="/sign-up" className="w-full sm:w-auto bg-white border-2 border-gray-200 text-gray-800 font-bold py-4 px-8 rounded-xl hover:bg-gray-50 transition-all">
            Sign Up Workspace
          </Link>
          <Link href="#how-it-works" className="w-full sm:w-auto bg-white border-2 border-dark-teal-600 text-dark-teal-600 font-bold py-4 px-8 rounded-xl hover:bg-dark-teal-50 transition-all">
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
                <h3 className="text-xl font-bold mb-4 group-hover:text-crimson-violet-600 transition-colors font-lexend">Everything In One Place</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Project data lives everywhere. Whether it is in the cloud, on local drives or across different teams, FieldOps pulls the key metrics into one single location. This gives leadership a clear overview of the entire project.</p>
            </div>
            <div className="group p-8 bg-[#fcfcfc] border border-gray-100 rounded-3xl hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-16 h-16 bg-dark-teal-50 rounded-2xl flex items-center justify-center mb-6 animate-float" style={{ animationDelay: '0.5s' }}>
                  <Image src="/window.svg" alt="Project Management" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-dark-teal-600 transition-colors font-lexend">Historical Footprint</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Create a living record of discussions, agreements, issues and progress. Learn from past successes and mistakes by reinforcing your team's experience with project data.</p>
            </div>
            <div className="group p-8 bg-[#fcfcfc] border border-gray-100 rounded-3xl hover:scale-105 transition-transform duration-300 shadow-sm hover:shadow-xl">
                <div className="w-16 h-16 bg-princeton-orange-50 rounded-2xl flex items-center justify-center mb-6 animate-float" style={{ animationDelay: '1s' }}>
                  <Image src="/globe.svg" alt="Real-time Analytics" width={32} height={32} />
                </div>
                <h3 className="text-xl font-bold mb-4 group-hover:text-princeton-orange-600 transition-colors font-lexend">Keep Teams Connected</h3>
                <p className="text-gray-600 leading-relaxed text-sm">Keep everyone aligned with built-in chats, notes and escalations. Control exactly who sees what with strict role-based access to your project data.</p>
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
                    <h4 className="text-lg font-bold mb-2 font-lexend">Organize the Chaos</h4>
                    <p className="text-dark-teal-100 text-sm">Pull in project data from anywhere. We bring your scattered summaries and overviews into one organized workspace.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-dark-teal-500 rounded-full flex items-center justify-center font-bold">2</div>
                  <div>
                    <h4 className="text-lg font-bold mb-2 font-lexend">Collaborate & Escalate</h4>
                    <p className="text-dark-teal-100 text-sm">Discuss issues, leave notes and follow up in real-time. Ensure the right people are solving the right problems.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-10 h-10 bg-dark-teal-500 rounded-full flex items-center justify-center font-bold">3</div>
                  <div>
                    <h4 className="text-lg font-bold mb-2 font-lexend">Learn & Improve</h4>
                    <p className="text-dark-teal-100 text-sm">Use the historical footprint to onboard new members and make informed decisions on current and future projects.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="md:w-1/2 bg-dark-teal-800 p-4 rounded-3xl shadow-2xl relative overflow-hidden group">
              {/* Decorative background blur */}
              <div className="absolute top-1/4 -right-1/4 w-64 h-64 bg-indigo-500/30 rounded-full blur-3xl group-hover:bg-indigo-500/40 transition-colors"></div>
              
              <div className="bg-[#fcfcfc] rounded-2xl overflow-hidden aspect-video relative flex flex-col shadow-inner border border-white/10">
                {/* Mock Browser/App Header */}
                <div className="h-8 bg-white border-b border-gray-100 flex items-center px-4 space-x-2 shrink-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-400"></div>
                </div>
                
                {/* Mock App Body */}
                <div className="flex flex-1 p-3 gap-3 overflow-hidden">
                  {/* Mock Sidebar */}
                  <div className="w-16 bg-gray-50 rounded-xl flex flex-col items-center py-4 space-y-4 shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100"></div>
                    <div className="w-6 h-6 rounded bg-gray-200"></div>
                    <div className="w-6 h-6 rounded bg-gray-200"></div>
                    <div className="w-6 h-6 rounded bg-gray-200"></div>
                  </div>
                  
                  {/* Mock Main Content */}
                  <div className="flex-1 flex flex-col gap-3">
                    {/* Mock Header Cards */}
                    <div className="grid grid-cols-2 gap-3 shrink-0">
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="h-2 w-16 bg-gray-200 rounded mb-3"></div>
                        <div className="h-5 w-24 bg-dark-teal-600 rounded"></div>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                        <div className="h-2 w-16 bg-gray-200 rounded mb-3"></div>
                        <div className="h-5 w-24 bg-indigo-600 rounded"></div>
                      </div>
                    </div>
                    
                    {/* Mock Table/List */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex-1 p-3">
                      <div className="h-3 w-32 bg-gray-200 rounded mb-4"></div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <div className="w-4 h-4 bg-gray-200 rounded"></div>
                            <div className="h-2 w-20 bg-gray-200 rounded mt-1"></div>
                          </div>
                          <div className="h-4 w-12 bg-emerald-100 rounded-full"></div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <div className="w-4 h-4 bg-gray-200 rounded"></div>
                            <div className="h-2 w-24 bg-gray-200 rounded mt-1"></div>
                          </div>
                          <div className="h-4 w-12 bg-amber-100 rounded-full"></div>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex space-x-2">
                            <div className="w-4 h-4 bg-gray-200 rounded"></div>
                            <div className="h-2 w-16 bg-gray-200 rounded mt-1"></div>
                          </div>
                          <div className="h-4 w-12 bg-emerald-100 rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 font-lexend">A Living System of Record</h2>
            <p className="text-lg text-gray-600 leading-relaxed">
              We built FieldOps because we were tired of losing project knowledge in disintegrated email chains and scattered folders. By bringing teams and data together, we give leadership total clarity, help teams work together and build a historical footprint of our projects.
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