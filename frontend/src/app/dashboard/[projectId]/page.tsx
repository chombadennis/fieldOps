'use client';

import { useEffect, useState } from 'react';
import { getProject, deleteBoqDocument } from '@/services/api';
import ProjectDetails from '@/components/ProjectDetails';
import UploadBOQ from '@/app/components/UploadBOQ';
import Report from '@/app/components/Report';
import DashboardSkeleton from '@/components/DashboardSkeleton';
import ErrorMessage from '@/components/ErrorMessage';
import ProjectIntegrations from '@/components/ProjectIntegrations';
import BoqDocumentList from '@/components/BoqDocumentList';
import BoqItemsModal from '@/components/BoqItemsModal';
import { AlertTriangle, X } from 'lucide-react';

export default function ProjectDashboardPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for viewing BOQ items modal
  const [selectedBoqId, setSelectedBoqId] = useState<number | null>(null);
  const [selectedBoqName, setSelectedBoqName] = useState<string>('');
  const [isBoqModalOpen, setIsBoqModalOpen] = useState(false);
  const [globalProcessing, setGlobalProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchProject = async () => {
    try {
      const projectData = await getProject(projectId);
      setProject(projectData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch project details.');
      console.error(err);
    }
  };

  const handleViewBoqItems = (boqId: number, docName: string) => {
    setSelectedBoqId(boqId);
    setSelectedBoqName(docName);
    setIsBoqModalOpen(true);
  };

  const handleDeleteBoqDocument = async (boqId: number) => {
    console.log("handleDeleteBoqDocument entered on page.tsx. boqId:", boqId);
    setGlobalProcessing(true);
    try {
      console.log("Sending delete request to API for boqId:", boqId);
      const res = await deleteBoqDocument(boqId);
      console.log("Delete request response:", res);
      console.log("Refetching project details...");
      await fetchProject();
      console.log("Project refetch complete.");
    } catch (err: any) {
      console.error("Exception caught in handleDeleteBoqDocument:", err);
      setActionError(err.response?.data?.detail || 'Failed to delete BOQ document.');
    } finally {
      console.log("Setting globalProcessing to false.");
      setGlobalProcessing(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchProject();
      setLoading(false);
    };
    init();
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
    <main className="container mx-auto p-4 space-y-8">
      <ProjectDetails project={project} />
      
      <ProjectIntegrations 
        projectId={project.id} 
        integrations={project.integrations || []} 
        onRefresh={fetchProject} 
        globalLoading={globalProcessing}
        setGlobalLoading={setGlobalProcessing}
      />

      <BoqDocumentList 
        documents={project.boq_documents || []} 
        onViewItems={handleViewBoqItems} 
        onDeleteDocument={handleDeleteBoqDocument}
        integrations={project.integrations || []}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <UploadBOQ projectId={project.id} onUploadSuccess={fetchProject} disabled={globalProcessing} />
        <Report projectId={project.id} />
      </div>

      <BoqItemsModal 
        isOpen={isBoqModalOpen} 
        onClose={() => setIsBoqModalOpen(false)} 
        boqId={selectedBoqId} 
        docName={selectedBoqName} 
        isReadOnly={project?.boq_documents?.find((d: any) => d.id === selectedBoqId)?.origin !== 'file_upload' && !project?.integrations?.some((i: any) => i.provider === project?.boq_documents?.find((d: any) => d.id === selectedBoqId)?.origin)}
      />

      {/* Custom Action Error Modal */}
      {actionError && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 flex flex-col relative animate-scale-up">
            <button
              onClick={() => setActionError(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 active:scale-95 transition-all duration-100"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-3 bg-red-50 rounded-xl text-red-600">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Action Required</h3>
                <p className="text-xs text-gray-400">Request could not be completed</p>
              </div>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed mb-6">
              {actionError}
            </p>

            <button
              onClick={() => setActionError(null)}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all duration-100"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </main>
  );
}