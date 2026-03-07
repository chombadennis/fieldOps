'use client';

import { useEffect, useState } from 'react';
import { getProject } from '@/services/api';
import ProjectDetails from '@/components/ProjectDetails';
import UploadBOQ from '@/app/components/UploadBOQ';
import Report from '@/app/components/Report';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ErrorMessage from '@/components/ErrorMessage';

export default function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        setLoading(true);
        const projectData = await getProject(projectId);
        setProject(projectData);
        setError(null);
      } catch (err) {
        setError('Failed to fetch project details.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  if (loading) {
    return (
      <main className="container mx-auto p-4">
        <DashboardSkeleton />
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto p-4">
        <ErrorMessage message={error} />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="container mx-auto p-4">
        <ErrorMessage message="Project not found." />
      </main>
    );
  }

  return (
    <main className="container mx-auto p-4">
      <ProjectDetails project={project} />
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        <UploadBOQ projectId={project.id} />
        <Report projectId={project.id} />
      </div>
    </main>
  );
}