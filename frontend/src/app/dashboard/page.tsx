'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getProjects } from '@/services/api';
import ProjectList from '@/components/ProjectList';
import { Project } from '@/models/project';
import CreateProjectModal from '@/components/CreateProjectModal';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ProjectListSkeleton from '@/components/ProjectListSkeleton';
import ErrorMessage from '@/components/ErrorMessage';
import Navpanel from '@/components/Navpanel';
import Footer from '@/components/Footer';
import { Plus, FolderKanban, Search, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const queryClient = useQueryClient();
  const { data: projects = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ['projects'],
    queryFn: getProjects,
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Convert queryError to a string or use a default message if it exists
  const error = queryError ? 'Failed to fetch projects.' : null;

  const filteredProjects = projects.filter(
    (p: any) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#030305] text-white selection:bg-neon-cyan/30 font-inter flex flex-col justify-between relative overflow-hidden">
      {/* Ambient Mesmerizing Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-neon-purple/20 rounded-full blur-[120px] animate-blob mix-blend-screen pointer-events-none"></div>
      <div className="absolute top-[30%] right-[-10%] w-[600px] h-[600px] bg-neon-cyan/20 rounded-full blur-[150px] animate-blob-slow mix-blend-screen pointer-events-none" style={{ animationDelay: '2s' }}></div>

      <div className="relative z-10">
        <Navpanel />

        <main className="container mx-auto px-4 md:px-8 py-24 space-y-8 animate-fade-in-up">
          {/* Top Hero Banner */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden">
            {/* Background Glow Accents */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-neon-purple/20 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-neon-cyan/20 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-3 py-1 bg-black/40 backdrop-blur-md rounded-full text-xs font-semibold text-neon-cyan border border-white/10 flex items-center shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-neon-cyan" /> Company Tenant Workspace
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight font-lexend text-white drop-shadow-md">
                  Projects Hub
                </h1>
                <p className="mt-2 text-sm text-gray-400 max-w-xl leading-relaxed">
                  Manage construction sites, BoQ parsing, project budgets, Interim Payment Certificates (IPCs), and departmental collaboration.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="relative group inline-flex items-center"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-neon-cyan to-neon-purple rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative px-6 py-3.5 bg-black hover:bg-black/80 text-white font-bold rounded-2xl text-sm border border-white/20 transition-all flex items-center">
                  <Plus className="w-5 h-5 mr-2" /> Create New Project
                </div>
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10 relative z-10">
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total Active Projects</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">{projects.length}</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Cloud Integrations</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">Google & OneDrive</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Core Modules</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">BoQ, Budget, IPC</p>
              </div>
              <div className="bg-black/40 backdrop-blur-md rounded-2xl p-4 border border-white/5">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">RBAC Security</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">Multi-Role Active</p>
              </div>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/50 border border-white/10 rounded-xl text-xs font-medium text-white placeholder-gray-500 focus:ring-1 focus:ring-neon-cyan focus:border-neon-cyan focus:outline-none transition-all"
              />
            </div>
            <div className="text-xs text-gray-400 font-semibold">
              Showing <span className="text-white font-bold">{filteredProjects.length}</span> of {projects.length} projects
            </div>
          </div>

          {/* Main Content Area */}
          <div>
            {loading ? (
              <ProjectListSkeleton />
            ) : error ? (
              <ErrorMessage message={error} />
            ) : filteredProjects.length === 0 ? (
              <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 text-center border border-dashed border-white/20 shadow-lg space-y-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neon-cyan/5 pointer-events-none"></div>
                <div className="w-16 h-16 bg-black/50 border border-white/10 text-neon-cyan rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                  <FolderKanban className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-lexend text-white drop-shadow-md">No Projects Found</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto relative z-10">
                  {searchQuery ? `No projects match "${searchQuery}".` : 'Get started by creating your first construction project workspace.'}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-5 py-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs transition-all relative z-10"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> Create Project
                </button>
              </div>
            ) : (
              <ProjectList projects={filteredProjects} />
            )}
          </div>
        </main>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProjectCreated={() => queryClient.invalidateQueries({ queryKey: ['projects'] })}
      />

      <Footer />
    </div>
  );
}