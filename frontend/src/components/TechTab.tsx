import React, { useState, useEffect } from 'react';
import { MessageSquare, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import TechIntegrations from '@/components/TechIntegrations';
import LinkedDocumentsPanel from '@/components/LinkedDocumentsPanel';
import DiscussionNoteInput from '@/components/DiscussionNoteInput';
import TechDocumentsPanel from '@/components/TechDocumentsPanel';
import TechManualEntryModal from '@/components/integrations/TechManualEntryModal';
import TechWorkflowPanels from '@/components/integrations/TechWorkflowPanels';
import TechWorkflowForm from '@/components/integrations/TechWorkflowForm';
import { unlinkProjectDocument, unlinkDecoupledDocument, deleteProjectDocument, deleteDecoupledDocument, createProjectNote, deleteProjectNote, getCurrentUser, updateProjectNote } from '@/services/api';
import { renderSafeHtml } from '@/lib/sanitize';

interface Note {
  id: number;
  content: string;
  department: string;
  is_issue?: boolean;
  priority?: string;
  author_name?: string;
  author_id?: number;
  created_at?: string;
  documents?: any[];
  values_map?: any;
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

export default function TechTab({
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
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [showTestModal, setShowTestModal] = useState(false);
  const [showWorkflowForm, setShowWorkflowForm] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isDeletingNote, setIsDeletingNote] = useState<number | null>(null);

  useEffect(() => {
    getCurrentUser().then(setCurrentUser).catch(console.error);
  }, []);
  const [isSubmittingWorkflow, setIsSubmittingWorkflow] = useState(false);

  const subTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'documents', label: 'Documents' },
    { id: 'rfis', label: 'RFIs' },
    { id: 'submittals', label: 'Submittals' },
    { id: 'issues', label: 'Issues' }
  ];

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

  const handleDeleteNote = async (noteId: number) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setIsDeletingNote(noteId);
    try {
      await deleteProjectNote(projectId, noteId);
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error(err);
      alert('Failed to delete item.');
    } finally {
      setIsDeletingNote(null);
    }
  };

  // Filter notes and docs for this department
  const filteredNotes = notes.filter((n) => n.department?.toLowerCase() === departmentKey.toLowerCase() || departmentKey === 'all');
  
  // Grouping discussion feed: Issues vs General
  const issueNotes = filteredNotes.filter(n => n.is_issue && !n.values_map?.type);
  const generalNotes = filteredNotes.filter(n => !n.is_issue && !n.values_map?.type);
  
  const filteredDocs = documents.filter((d) => d.department?.toLowerCase() === departmentKey.toLowerCase() || departmentKey === 'all');  return (
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

      {/* Sub-Navigation */}
      <div className="flex space-x-2 border-b border-white/10 pb-2 overflow-x-auto custom-scrollbar items-center">
        {subTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors whitespace-nowrap ${
              activeSubTab === tab.id
                ? 'bg-white/10 text-white border-b-2 border-neon-cyan shadow-inner'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
          </button>
        ))}
        
        {['rfi', 'submittal', 'issue'].includes(activeSubTab.slice(0, -1)) && (
          <button
            onClick={() => setShowWorkflowForm(true)}
            className="ml-auto px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md flex items-center gap-1.5"
          >
            <span className="text-lg leading-none mb-0.5">+</span> New {activeSubTab.slice(0, -1).toUpperCase()}
          </button>
        )}
      </div>
      {/* Overview Sub-Tab */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Cloud File Integration (Google Drive & OneDrive) */}
          {integrations && onRefresh && setGlobalLoading && (
            <TechIntegrations
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

      <div className="space-y-6">
        {/* Issues Feed */}
        {issueNotes.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neon-pink/80 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Active Issues
            </h4>
            <div className="space-y-4">
              {issueNotes.map((note) => (
                <div key={note.id} className="bg-neon-pink/5 backdrop-blur-md rounded-3xl p-6 border border-neon-pink/50 shadow-[0_4px_15px_rgba(255,0,127,0.1)] transition relative group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold font-lexend text-white drop-shadow-sm">{note.author_name || 'Team Member'}</span>
                      <span className="text-xs text-gray-500">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neon-pink/20 text-neon-pink border border-neon-pink/50">
                        <AlertTriangle className="w-3 h-3 mr-1" /> {note.priority || 'High'} Issue
                      </span>
                      {currentUser?.id === note.author_id && (
                        <div className="hidden group-hover:flex items-center gap-1 ml-2">
                          <button onClick={() => handleDeleteNote(note.id)} disabled={isDeletingNote === note.id} className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed font-medium note-content-html" dangerouslySetInnerHTML={{ __html: renderSafeHtml(note.content) }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General Discussion Feed */}
        <div className="space-y-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 font-inter">Discussion Feed</h4>
          {generalNotes.length === 0 ? (
            <div className="bg-white/5 backdrop-blur-md rounded-3xl p-10 text-center border border-dashed border-white/10 shadow-sm">
              <MessageSquare className="w-8 h-8 text-gray-600 drop-shadow-sm mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">No general notes recorded for this department yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {generalNotes.map((note) => (
                <div key={note.id} className="bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/10 shadow-[0_4px_15px_rgba(0,0,0,0.2)] transition relative group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold font-lexend text-white drop-shadow-sm">{note.author_name || 'Team Member'}</span>
                      <span className="text-xs text-gray-500">• {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}</span>
                    </div>

                    {currentUser?.id === note.author_id && (
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button onClick={() => handleDeleteNote(note.id)} disabled={isDeletingNote === note.id} className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-gray-300 leading-relaxed font-medium note-content-html" dangerouslySetInnerHTML={{ __html: renderSafeHtml(note.content) }} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
        </div>
      )}

      {/* Documents Sub-Tab */}
      {activeSubTab === 'documents' && (
        <div className="animate-fade-in">
          <TechDocumentsPanel documents={filteredDocs} />
        </div>
      )}

      {/* Workflow Sub-Tabs */}
      {['rfis', 'submittals', 'issues'].includes(activeSubTab) && (
        <div className="animate-fade-in">
          <TechWorkflowPanels 
            workflowType={activeSubTab.slice(0, -1) as any} 
            notes={filteredNotes} 
            currentUser={currentUser}
            onEdit={(note) => {
              setEditingNote(note);
              setShowWorkflowForm(true);
            }}
            onDelete={handleDeleteNote}
            isDeletingId={isDeletingNote}
          />
        </div>
      )}

      {/* TEMPORARY MODAL RENDER */}
      <TechManualEntryModal
        show={showTestModal}
        onClose={() => setShowTestModal(false)}
        onSubmit={(data) => {
          console.log('Test modal submitted data:', data);
          setShowTestModal(false);
          alert('Check console for submitted data!');
        }}
        initialData={{
          url: 'https://docs.google.com/test-url',
          title: 'Test Document Preview'
        }}
      />

      {/* Workflow Form Modal */}
      {showWorkflowForm && (
        <TechWorkflowForm
          workflowType={activeSubTab.slice(0, -1) as any}
          documents={filteredDocs}
          initialData={editingNote}
          onClose={() => {
            setShowWorkflowForm(false);
            setEditingNote(null);
          }}
          isSubmitting={isSubmittingWorkflow}
          onSubmit={async (data) => {
            setIsSubmittingWorkflow(true);
            try {
              if (editingNote) {
                await updateProjectNote(projectId, editingNote.id, {
                  ...data,
                  department: departmentKey
                });
              } else {
                await createProjectNote(projectId, {
                  ...data,
                  department: departmentKey
                });
              }
              setShowWorkflowForm(false);
              setEditingNote(null);
              if (onRefresh) onRefresh();
            } catch (err) {
              console.error('Failed to save workflow item:', err);
              alert('Failed to save item. See console for details.');
            } finally {
              setIsSubmittingWorkflow(false);
            }
          }}
        />
      )}
    </div>
  );
}
