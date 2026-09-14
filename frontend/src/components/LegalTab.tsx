import React, { useState } from 'react';
import LegalIntegrations from '@/components/LegalIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import CollaborationPanel from '@/components/CollaborationPanel';
import { unlinkProjectDocument, unlinkDecoupledDocument, deleteProjectDocument, deleteDecoupledDocument } from '@/services/api';

interface Note {
  id: number;
  content: string;
  department: string;
  is_issue?: boolean;
  priority?: string;
  author_name?: string;
  created_at?: string;
  documents?: any[];
}

interface Document {
  id: number;
  title: string;
  file_url: string;
  file_type?: string;
  department?: string;
  created_at?: string;
  integration_id?: number;
  uploaded_by?: number;
  cloud_email?: string;
}

interface DepartmentTabProps {
  projectId: number;
  departmentName: string;
  departmentKey: string;
  apiEndpoint?: string;
  description: string;
  colorTheme: string;
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  boqDocuments?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
  activeTab?: string;
}

export default function LegalTab({
  projectId,
  departmentName,
  departmentKey,
  apiEndpoint,
  description,
  colorTheme,
  notes = [],
  documents = [],
  onAddNote,
  integrations,
  boqDocuments,
  onRefresh,
  globalLoading,
  setGlobalLoading,
  activeTab,
}: DepartmentTabProps) {
  const [unlinkingId, setUnlinkingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleUnlinkDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setUnlinkingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      if (apiEndpoint) {
        await unlinkDecoupledDocument(projectId, apiEndpoint, documentId);
      } else {
        await unlinkProjectDocument(projectId, documentId);
      }
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to unlink document.');
    } finally {
      setUnlinkingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!onRefresh) return;
    setDeletingId(documentId);
    if (setGlobalLoading) setGlobalLoading(true);
    try {
      if (apiEndpoint) {
        await deleteDecoupledDocument(projectId, apiEndpoint, documentId);
      } else {
        await deleteProjectDocument(projectId, documentId);
      }
      await onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete document data.');
    } finally {
      setDeletingId(null);
      if (setGlobalLoading) setGlobalLoading(false);
    }
  };

  // Filter notes and docs for this department
  const filteredNotes = notes.filter((n) => n.department?.toLowerCase() === departmentKey.toLowerCase() || departmentKey === 'all');
  const filteredDocs = documents.filter((d) => d.department?.toLowerCase() === departmentKey.toLowerCase() || departmentKey === 'all');



  return (
    <div className="space-y-6">
      {/* Department Header Banner */}
      <div className={`bg-white/5 backdrop-blur-xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] rounded-3xl p-8 text-white ${colorTheme} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden`}>
        <div className="absolute top-0 left-0 -translate-y-12 -translate-x-12 w-64 h-64 bg-neon-cyan/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />
        
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-neon-cyan drop-shadow-sm">Department Workspace</span>
          <h2 className="text-xl font-bold font-lexend mt-1 drop-shadow-md">{departmentName} Hub</h2>
          <p className="text-xs text-gray-400 mt-1 max-w-xl leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Cloud File Integration (Google Drive & OneDrive) */}
          {integrations && onRefresh && setGlobalLoading && (
        <LegalIntegrations
          projectId={String(projectId)}
          integrations={integrations}
          onRefresh={onRefresh}
          globalLoading={!!globalLoading}
          setGlobalLoading={setGlobalLoading}
          moduleContext="department"
          departmentName={departmentName}
          departmentKey={departmentKey}
          activeTab={activeTab}
          apiEndpoint={apiEndpoint}
        />
      )}

      {/* Linked Documents Panel */}
      <LinkedDocumentsPanel
        title="Linked Documents"
        documents={filteredDocs}
        onUnlink={handleUnlinkDocument}
        onDelete={handleDeleteDocument}
        unlinkingId={unlinkingId}
        deletingId={deletingId}
        emptyMessage="No documents linked to this department section."
      />

        </div>
        <div className="shrink-0">
          {/* Collaboration Panel — Threads / Tasks / Log */}
          <CollaborationPanel
        projectId={projectId}
        module={departmentKey}
        moduleName={departmentName}
          />
        </div>
      </div>
    </div>
  );
}
