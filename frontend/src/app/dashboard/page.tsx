'use client'

import { useEffect, useState } from 'react';
import { getProjects } from '@/services/api';
import ProjectList from '@/components/ProjectList';
import { Project } from '@/models/project';
import CreateProjectModal from '@/components/CreateProjectModal';
import ProjectListSkeleton from '@/components/ProjectListSkeleton';
import ErrorMessage from '@/components/ErrorMessage';

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await getProjects();
      setProjects(projectsData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch projects.');
      setProjects([]); // Clear projects on error
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const renderContent = () => {
    if (loading) {
      return <ProjectListSkeleton />;
    }
    if (error) {
      return <ErrorMessage message={error} />;
    }
    if (projects.length === 0) {
      return (
        <div className="text-center p-8 bg-white shadow-md rounded-lg">
          <h2 className="text-2xl font-bold text-gray-800">No Projects Found</h2>
          <p className="mt-2 text-gray-600">Get started by creating one!</p>
        </div>
      );
    }
    return <ProjectList projects={projects} />;
  };

  return (
    <main className="container mx-auto p-4">
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">Projects Dashboard</h1>
        <button onClick={() => setIsModalOpen(true)} className="bg-crimson-violet-600 text-white font-bold py-2 px-4 rounded-md hover:bg-crimson-violet-700 transition-colors">Create Project</button>
      </header>

      <div>
        {renderContent()}
      </div>

      <CreateProjectModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onProjectCreated={fetchProjects} 
      />
    </main>
  );
}