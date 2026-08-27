import React, { useState } from 'react';
import { MessageSquare, Send, AlertTriangle } from 'lucide-react';
import ProgramOfWorksIntegrations from '@/components/ProgramOfWorksIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
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

export default function ProgramOfWorksTab({
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
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
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

  const handlePostNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setPosting(true);
    try {
      await onAddNote({
        content,
        department: departmentKey,
        is_issue: isIssue,
        priority: isIssue ? priority : 'Normal',
      });
      setContent('');
      setIsIssue(false);
      setPriority('Normal');
    } catch (err) {
      console.error(err);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Department Header Banner */}
      <div className={`rounded-3xl p-8 shadow-2xl text-white ${colorTheme} flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative overflow-hidden`}>
        <div className="relative z-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-white/70">Department Workspace</span>
          <h2 className="text-xl font-bold font-lexend mt-1">{departmentName} Hub</h2>
          <p className="text-xs text-white/80 mt-1 max-w-xl leading-relaxed">{description}</p>
        </div>
      </div>

      {/* Cloud File Integration (Google Drive & OneDrive) */}
      {integrations && onRefresh && setGlobalLoading && (
        <ProgramOfWorksIntegrations
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

      {/* Discussion & Entry Feed */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
        <h3 className="text-sm font-bold font-lexend text-gray-800">Add Discussion Note / Log Issue</h3>
        <form onSubmit={handlePostNote} className="space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Share an update or report an issue regarding ${departmentName}...`}
            rows={3}
            className="w-full p-4 bg-gray-50 border border-gray-150 rounded-2xl text-xs focus:ring-2 focus:ring-dark-teal-500/20 focus:border-dark-teal-500 focus:outline-none transition font-medium"
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
            <div className="flex items-center space-x-6">
              <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isIssue}
                  onChange={(e) => setIsIssue(e.target.checked)}
                  className="w-4 h-4 rounded text-dark-teal-900 border-gray-300 focus:ring-dark-teal-500"
                />
                <span className="text-xs font-bold text-gray-700">Flag as Site Issue</span>
              </label>

              {isIssue && (
                <div className="flex items-center space-x-2 animate-fade-in">
                  <span className="text-xs text-gray-400 font-semibold">Priority:</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="p-1.5 bg-gray-50 border border-gray-150 rounded-xl text-xs font-bold text-gray-700 focus:outline-none"
                  >
                    <option value="Low">Low</option>
                    <option value="Normal">Normal</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={posting || !content.trim()}
              className="px-5 py-3 bg-dark-teal-800 hover:bg-dark-teal-900 text-white font-bold rounded-xl text-xs shadow-md disabled:opacity-50 transition active:scale-95 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{posting ? 'Posting...' : 'Post Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">Discussion Feed</h4>
        {filteredNotes.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-dashed border-gray-200">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No notes recorded for this department yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white rounded-3xl p-6 border shadow-sm transition ${
                  note.is_issue ? 'border-deep-crimson-200 bg-deep-crimson-50/20' : 'border-gray-100'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold font-lexend text-gray-900">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-400">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-deep-crimson-50 text-deep-crimson-700 border border-deep-crimson-200">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-line font-medium">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
