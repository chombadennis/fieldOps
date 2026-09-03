import Link from 'next/link';
import Image from 'next/image';
import Navpanel from '@/components/Navpanel';
import Footer from '@/components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-neon-cyan/30 font-inter relative overflow-hidden">
      {/* Ambient Mesmerizing Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-purple/20 rounded-full blur-[120px] animate-blob mix-blend-screen pointer-events-none"></div>
      <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-neon-cyan/20 rounded-full blur-[150px] animate-blob-slow mix-blend-screen pointer-events-none" style={{ animationDelay: '2s' }}></div>
      <div className="absolute bottom-[-10%] left-[20%] w-[400px] h-[400px] bg-neon-pink/10 rounded-full blur-[100px] animate-blob mix-blend-screen pointer-events-none" style={{ animationDelay: '4s' }}></div>

      <div className="relative z-10">
        <Navpanel />

        {/* Hero Section */}
        <header className="container mx-auto px-6 pt-32 pb-24 md:pt-40 md:pb-32 text-center animate-fade-in-up">
          <h1 className="text-3xl md:text-5xl font-extrabold mb-6 tracking-tight font-lexend leading-tight text-white drop-shadow-lg">
            Bring Order To <br />
            <span className="text-2xl md:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-neon-cyan via-white to-neon-purple pb-2 inline-block drop-shadow-[0_0_20px_rgba(0,243,255,0.4)]">
              Project Chaos
            </span>
          </h1>
          <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            Connect scattered data, teams and insights into one unified workspace. Give leadership total visibility, build a historical footprint and keep everyone on the same page from day one to handover.
          </p>
          <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6">
            <Link href="/dashboard" className="w-full sm:w-auto relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-xl blur opacity-60 group-hover:opacity-100 transition duration-500"></div>
              <div className="relative w-full bg-black/50 backdrop-blur-md border border-white/20 text-white font-bold py-4 px-8 rounded-xl flex items-center justify-center transition-all">
                Enter Demo Dashboard
              </div>
            </Link>
            <Link href="/sign-up" className="w-full sm:w-auto bg-white/5 backdrop-blur-md border border-white/10 text-white font-bold py-4 px-8 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all shadow-lg">
              Sign Up Workspace
            </Link>
          </div>
        </header>

        {/* Features Section */}
        <section id="features" className="py-12 md:py-16 relative">
          <div className="container mx-auto px-6 relative z-10">
            <div className="text-center mb-20">
              <h2 className="text-3xl font-bold mb-4 font-lexend text-white drop-shadow-md">Key Features</h2>
              <div className="h-1 w-20 bg-gradient-to-r from-neon-cyan to-neon-purple mx-auto rounded-full shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
              <p className="mt-6 text-gray-400 max-w-xl mx-auto text-base">Everything you need to move from blueprint to ribbon-cutting in record time.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="group p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-neon-cyan/50 hover:bg-white/10 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(0,243,255,0.2)]">
                <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 animate-float shadow-inner group-hover:border-neon-cyan/50 transition-colors">
                  <Image src="/file.svg" alt="Bidding" width={32} height={32} className="opacity-80 group-hover:opacity-100 invert" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white group-hover:text-neon-cyan transition-colors font-lexend">Everything In One Place</h3>
                <p className="text-gray-400 leading-relaxed text-sm">Project data lives everywhere. Whether it is in the cloud, on local drives or across different teams, FieldOps pulls the key metrics into one single location.</p>
              </div>
              <div className="group p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-neon-purple/50 hover:bg-white/10 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(157,0,255,0.2)]">
                <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 animate-float shadow-inner group-hover:border-neon-purple/50 transition-colors" style={{ animationDelay: '0.5s' }}>
                  <Image src="/window.svg" alt="Project Management" width={32} height={32} className="opacity-80 group-hover:opacity-100 invert" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white group-hover:text-neon-purple transition-colors font-lexend">Historical Footprint</h3>
                <p className="text-gray-400 leading-relaxed text-sm">Create a living record of discussions, agreements, issues and progress. Learn from past successes and mistakes by reinforcing your team's experience.</p>
              </div>
              <div className="group p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:border-neon-pink/50 hover:bg-white/10 transition-all duration-500 shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:shadow-[0_0_30px_rgba(255,0,127,0.2)]">
                <div className="w-16 h-16 bg-black/40 border border-white/10 rounded-2xl flex items-center justify-center mb-6 animate-float shadow-inner group-hover:border-neon-pink/50 transition-colors" style={{ animationDelay: '1s' }}>
                  <Image src="/globe.svg" alt="Real-time Analytics" width={32} height={32} className="opacity-80 group-hover:opacity-100 invert" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-white group-hover:text-neon-pink transition-colors font-lexend">Keep Teams Connected</h3>
                <p className="text-gray-400 leading-relaxed text-sm">Keep everyone aligned with built-in chats, notes and escalations. Control exactly who sees what with strict role-based access to your project data.</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-32 md:py-40 relative border-t border-white/5 mt-16">
          <div className="container mx-auto px-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-16">
              <div className="md:w-1/2">
                <h2 className="text-3xl font-bold mb-8 font-lexend text-white drop-shadow-md">How FieldOps Works</h2>
                <div className="space-y-8">
                  <div className="flex gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center font-bold text-neon-cyan group-hover:border-neon-cyan/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">1</div>
                    <div>
                      <h4 className="text-lg font-bold mb-2 font-lexend text-white group-hover:text-neon-cyan transition-colors">Organize the Chaos</h4>
                      <p className="text-gray-400 text-sm">Pull in project data from anywhere. We bring your scattered summaries and overviews into one organized workspace.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center font-bold text-neon-purple group-hover:border-neon-purple/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">2</div>
                    <div>
                      <h4 className="text-lg font-bold mb-2 font-lexend text-white group-hover:text-neon-purple transition-colors">Collaborate & Escalate</h4>
                      <p className="text-gray-400 text-sm">Discuss issues, leave notes and follow up in real-time. Ensure the right people are solving the right problems.</p>
                    </div>
                  </div>
                  <div className="flex gap-4 group">
                    <div className="flex-shrink-0 w-12 h-12 bg-white/5 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center font-bold text-neon-pink group-hover:border-neon-pink/50 transition-all shadow-[0_0_15px_rgba(0,0,0,0.5)]">3</div>
                    <div>
                      <h4 className="text-lg font-bold mb-2 font-lexend text-white group-hover:text-neon-pink transition-colors">Learn & Improve</h4>
                      <p className="text-gray-400 text-sm">Use the historical footprint to onboard new members and make informed decisions on current and future projects.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="md:w-1/2 p-1 rounded-3xl bg-gradient-to-br from-white/20 via-white/5 to-transparent relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-neon-cyan/20 to-neon-purple/20 blur-2xl group-hover:blur-3xl transition-all duration-700 opacity-50 z-0"></div>
                <div className="bg-[#050505] rounded-[22px] overflow-hidden aspect-video relative flex flex-col shadow-2xl border border-white/10 z-10 font-inter">
                  {/* Mock Browser/App Header */}
                  <div className="h-8 bg-black/60 backdrop-blur-md border-b border-white/10 flex items-center px-4 space-x-2 shrink-0">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    <div className="flex-1 flex justify-center">
                      <div className="h-4 w-32 bg-white/5 rounded-full border border-white/10"></div>
                    </div>
                  </div>

                  {/* Mock App Body */}
                  <div className="flex flex-1 p-3 gap-3 overflow-hidden bg-black/40">
                    {/* Mock Sidebar */}
                    <div className="w-14 bg-white/5 backdrop-blur-md border border-white/5 rounded-xl flex flex-col items-center py-4 space-y-5 shrink-0">
                      <Image src="/favicon.ico" alt="FieldOps Logo" width={32} height={32} className="w-8 h-8 drop-shadow-[0_0_10px_rgba(0,243,255,0.3)]" />
                      <div className="w-5 h-5 rounded-md bg-white/20"></div>
                      <div className="w-5 h-5 rounded-md bg-white/10"></div>
                      <div className="w-5 h-5 rounded-md bg-white/10"></div>
                    </div>

                    {/* Mock Main Content */}
                    <div className="flex-1 flex flex-col gap-3">
                      {/* Mock Header Cards */}
                      <div className="grid grid-cols-2 gap-3 shrink-0">
                        <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Active Projects</span>
                          <div className="flex items-end justify-between mt-1">
                            <span className="text-xl font-bold text-white">12</span>
                            <span className="text-[10px] text-neon-cyan bg-neon-cyan/10 px-1.5 py-0.5 rounded border border-neon-cyan/30">+2 this week</span>
                          </div>
                        </div>
                        <div className="bg-white/5 backdrop-blur-sm p-3 rounded-xl border border-white/10 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">Pending Approvals</span>
                          <div className="flex items-end justify-between mt-1">
                            <span className="text-xl font-bold text-white">5</span>
                            <span className="text-[10px] text-neon-pink bg-neon-pink/10 px-1.5 py-0.5 rounded border border-neon-pink/30">Action needed</span>
                          </div>
                        </div>
                      </div>

                      {/* Mock Table/List */}
                      <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 flex-1 p-3 flex flex-col overflow-hidden">
                        <span className="text-xs text-white font-bold mb-3 border-b border-white/10 pb-2">Recent Activity</span>
                        <div className="space-y-2 flex-1 overflow-hidden">
                          {/* Task 1 */}
                          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-white font-medium">Site Alpha - Foundation Pour</span>
                              <span className="text-[9px] text-gray-500">Updated by Achol Malual • 2h ago</span>
                            </div>
                            <span className="text-[9px] font-bold text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/50 px-2 py-0.5 rounded-full">In Progress</span>
                          </div>
                          {/* Task 2 */}
                          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-white font-medium">Blueprint Revision v4.2</span>
                              <span className="text-[9px] text-gray-500">Uploaded by Claxton Okudupe • 5h ago</span>
                            </div>
                            <span className="text-[9px] font-bold text-neon-purple bg-neon-purple/10 border border-neon-purple/50 px-2 py-0.5 rounded-full">Under Review</span>
                          </div>
                          {/* Task 3 */}
                          <div className="flex justify-between items-center p-2 rounded-lg bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[11px] text-white font-medium">Safety Inspection - Block B</span>
                              <span className="text-[9px] text-gray-500">Completed by Emma Michaelson • 1d ago</span>
                            </div>
                            <span className="text-[9px] font-bold text-green-400 bg-green-400/10 border border-green-400/50 px-2 py-0.5 rounded-full">Completed</span>
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
        <section className="py-16 md:py-24 relative border-t border-white/5">
          <div className="container mx-auto px-6 text-center">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold mb-8 font-lexend text-white drop-shadow-md">A Living System of Record</h2>
              <p className="text-lg text-gray-400 leading-relaxed">
                We built FieldOps because we were tired of losing project knowledge in disintegrated email chains and scattered folders. By bringing teams and data together, we give leadership total clarity, help teams work together and build a historical footprint of our projects.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 md:py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neon-purple/10 pointer-events-none"></div>
          <div className="container mx-auto px-6 text-center relative z-10">
            <div className="max-w-4xl mx-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 md:p-20 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-neon-cyan/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-neon-pink/20 blur-[100px] rounded-full mix-blend-screen pointer-events-none"></div>

              <h2 className="text-2xl md:text-3xl font-bold mb-6 font-lexend text-white relative z-10 drop-shadow-lg">Ready to take control of your projects?</h2>
              <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto relative z-10">
                Join hundreds of construction firms scaling their operations with FieldOps.
              </p>
              <div className="flex flex-col sm:flex-row justify-center items-center space-y-4 sm:space-y-0 sm:space-x-6 relative z-10">
                <Link href="/sign-up" className="relative group w-full sm:w-auto">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-xl blur opacity-75 group-hover:opacity-100 transition duration-500"></div>
                  <div className="relative bg-black text-white font-bold py-4 px-10 rounded-xl flex items-center justify-center transition-all">
                    Start Free Trial
                  </div>
                </Link>
                <Link href="#" className="w-full sm:w-auto border border-white/20 bg-white/5 backdrop-blur-md hover:bg-white/10 hover:border-white/30 text-white font-bold py-4 px-10 rounded-xl transition-all">
                  Contact Sales
                </Link>
              </div>
              <p className="mt-8 text-gray-500 text-sm relative z-10">No credit card required • 14-day free trial • Cancel anytime</p>
            </div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}