import React, { useState } from 'react';
import { MessageSquare, AlertTriangle } from 'lucide-react';
import ReimbursableCostsIntegrations from '@/components/ReimbursableCostsIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import DiscussionNoteInput from '@/components/DiscussionNoteInput';
import { unlinkProjectDocument, unlinkDecoupledDocument, deleteProjectDocument, deleteDecoupledDocument } from '@/services/api';
import { renderSafeHtml } from '@/lib/sanitize';

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

export default function ReimbursableCostsTab({
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

      {/* Cloud File Integration (Google Drive & OneDrive) */}
      {integrations && onRefresh && setGlobalLoading && (
        <ReimbursableCostsIntegrations
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

      <DiscussionNoteInput 
        onAddNote={onAddNote}
        departmentKey={departmentKey}
        placeholder={`Share an update or report an issue regarding ${departmentName}...`}
      />

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter">Discussion Feed</h4>
        {filteredNotes.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-md rounded-3xl p-10 text-center border border-dashed border-white/10 shadow-sm">
            <MessageSquare className="w-8 h-8 text-gray-600 drop-shadow-sm mx-auto mb-2" />
            <p className="text-xs text-gray-500 font-medium">No notes recorded for this department yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white/5 backdrop-blur-md rounded-3xl p-6 border shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition ${
                  note.is_issue ? 'border-neon-pink/50 bg-neon-pink/5' : 'border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-white drop-shadow-sm">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-500">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neon-pink/20 text-neon-pink border border-neon-pink/50 shadow-[0_0_10px_rgba(255,0,127,0.3)]">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <div 
                  className="text-xs text-gray-300 leading-relaxed font-medium note-content-html"
                  dangerouslySetInnerHTML={{ __html: renderSafeHtml(note.content) }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
