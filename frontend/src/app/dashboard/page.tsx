'use client';

import { useEffect, useState } from 'react';
import { getProjects } from '@/services/api';
import ProjectList from '@/components/ProjectList';
import { Project } from '@/models/project';
import CreateProjectModal from '@/components/CreateProjectModal';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ProjectListSkeleton from '@/components/ProjectListSkeleton';
import ErrorMessage from '@/components/ErrorMessage';
import Navpanel from '@/components/Navpanel';
import Footer from '@/components/Footer';
import { Plus, FolderKanban, TrendingUp, Building2, Search, ShieldCheck } from 'lucide-react';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch projects.');
      setProjects([]);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-[#fcfcfc] text-gray-900 font-inter flex flex-col justify-between">
      <div>
        <Navpanel />

        <main className="container mx-auto px-4 md:px-8 py-8 space-y-8 animate-fade-in-up">
          {/* Top Hero Banner */}
          <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-crimson-violet-950 text-white rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            {/* Background Glow Accents */}
            <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-80 h-80 bg-crimson-violet-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-dark-teal-500/20 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-semibold text-dark-teal-200 border border-white/10 flex items-center">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1.5 text-dark-teal-400" /> Company Tenant Workspace
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight font-lexend text-white">
                  Projects Hub
                </h1>
                <p className="mt-2 text-xs text-dark-teal-100/80 max-w-xl leading-relaxed">
                  Manage construction sites, BoQ parsing, project budgets, Interim Payment Certificates (IPCs), and departmental collaboration.
                </p>
              </div>

              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center px-6 py-3.5 bg-gradient-to-r from-crimson-violet-600 to-deep-crimson-600 hover:from-crimson-violet-500 hover:to-deep-crimson-500 text-white font-bold rounded-2xl text-sm shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-0.5 active:scale-95"
              >
                <Plus className="w-5 h-5 mr-2" /> Create New Project
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-medium text-dark-teal-200 uppercase tracking-wider">Total Active Projects</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">{projects.length}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-medium text-dark-teal-200 uppercase tracking-wider">Cloud Integrations</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">Google & OneDrive</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-medium text-dark-teal-200 uppercase tracking-wider">Core Modules</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">BoQ, Budget, IPC</p>
              </div>
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <p className="text-xs font-medium text-dark-teal-200 uppercase tracking-wider">RBAC Security</p>
                <p className="text-sm font-bold font-lexend mt-1 text-white">Multi-Role Active</p>
              </div>
            </div>
          </div>

          {/* Search & Action Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-full sm:w-96">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search projects by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-dark-teal-500 focus:bg-white focus:outline-none transition"
              />
            </div>
            <div className="text-xs text-gray-500 font-semibold">
              Showing <span className="text-dark-teal-700 font-bold">{filteredProjects.length}</span> of {projects.length} projects
            </div>
          </div>

          {/* Main Content Area */}
          <div>
            {loading ? (
              <ProjectListSkeleton />
            ) : error ? (
              <ErrorMessage message={error} />
            ) : filteredProjects.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-gray-200 shadow-sm space-y-4">
                <div className="w-16 h-16 bg-dark-teal-50 text-dark-teal-600 rounded-2xl flex items-center justify-center mx-auto">
                  <FolderKanban className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold font-lexend text-gray-800">No Projects Found</h3>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  {searchQuery ? `No projects match "${searchQuery}".` : 'Get started by creating your first construction project workspace.'}
                </p>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center px-5 py-2.5 bg-dark-teal-700 hover:bg-dark-teal-800 text-white font-bold rounded-xl text-xs shadow-md transition"
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
        onProjectCreated={fetchProjects}
      />

      <Footer />
    </div>
  );
}