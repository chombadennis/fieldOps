import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, AlertTriangle, FileSpreadsheet, Layers, Info } from 'lucide-react';
import ActivityScheduleIntegrations from '@/components/ActivityScheduleIntegrations';
import ActivityScheduleInlineEditor from '@/components/integrations/ActivityScheduleInlineEditor';
import DiscussionNoteInput from '@/components/DiscussionNoteInput';
import { renderSafeHtml } from '@/lib/sanitize';
import { getDecoupledDocuments } from '@/services/api';

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

interface ActivityScheduleTabProps {
  projectId: number;
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
}

export default function ActivityScheduleTab({
  projectId,
  notes = [],
  documents = [],
  onAddNote,
  integrations = [],
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: ActivityScheduleTabProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();
  const { data: activeDocuments = [], isLoading: loadingDocs } = useQuery({
    queryKey: ['documents', projectId, 'activity_schedule'],
    queryFn: () => getDecoupledDocuments(projectId, 'activity_schedule')
  });



  // Filter notes for this workspace
  const filteredNotes = notes.filter((note) => note.department?.toLowerCase() === 'activity_schedule');

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Summary Banner */}
      <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Baseline & Progress Module</span>
          <h2 className="text-xl font-bold font-lexend mt-1">Lump Sum Activity Schedules</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
            Link and audit work progress weighting schedules. Support for Excel spreadsheets, Word templates, and visual PDF files with inline table overrides.
          </p>
        </div>
      </div>

      {/* Integrations panel */}
      <ActivityScheduleIntegrations
        projectId={projectId}
        integrations={integrations}
        documents={documents}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'activity_schedule'] });
          if (onRefresh) onRefresh();
        }}
        globalLoading={globalLoading}
        setGlobalLoading={setGlobalLoading}
      />

      {/* Main Table Breakdown List */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-2">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-gray-400 font-inter">Active Schedules Matrix</h3>
          <span className="text-[10px] font-bold text-dark-teal-700 bg-dark-teal-50 px-2 py-0.5 rounded border border-dark-teal-100">
            {activeDocuments.length} Schedule{activeDocuments.length !== 1 ? 's' : ''} Linked
          </span>
        </div>

        {loadingDocs ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/10 text-center flex flex-col items-center justify-center space-y-2 text-gray-400 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-semibold">Loading schedules from database...</p>
          </div>
        ) : activeDocuments.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-12 border border-white/10 text-center shadow-[0_8px_32px_rgba(0,0,0,0.5)] space-y-3">
            <FileSpreadsheet className="w-12 h-12 text-gray-600 drop-shadow-sm mx-auto" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-white">No Active Schedules Found</h4>
              <p className="text-[11px] text-gray-400 max-w-md mx-auto">
                No database records exist for activity schedules. Connect a workbook or upload a PDF document in the panel below to initiate AI parsing.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDocuments.map((doc: any) => (
              <ActivityScheduleInlineEditor
                key={doc.id}
                projectId={projectId}
                documentId={doc.id}
                documentTitle={doc.title}
                onRefresh={() => {
                  queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'activity_schedule'] });
                  if (onRefresh) onRefresh();
                }}
              />
            ))}
          </div>
        )}
      </div>


      {/* Discussion & Note Form */}
      <DiscussionNoteInput 
        onAddNote={onAddNote}
        departmentKey="activity_schedule"
        placeholder="Log progress comments or flag schedule revisions..."
        variant="dark"
      />

      {/* Discussion Feed */}
      <div className="space-y-4">
        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 font-inter">Discussion Feed</h4>
        
        {filteredNotes.length === 0 ? (
          <div className="bg-white/5 backdrop-blur-xl rounded-3xl p-10 text-center border border-dashed border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <MessageSquare className="w-8 h-8 text-gray-600 drop-shadow-sm mx-auto mb-2" />
            <p className="text-xs text-gray-400 font-medium">No notes recorded for this schedule yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => (
              <div
                key={note.id}
                className={`bg-white/5 backdrop-blur-xl rounded-3xl p-6 border shadow-[0_8px_32px_rgba(0,0,0,0.5)] transition ${
                  note.is_issue ? 'border-red-500/30 bg-red-900/10' : 'border-white/10'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-white font-lexend">{note.author_name || 'Team Member'}</span>
                    <span className="text-xs text-gray-500">
                      • {note.created_at ? new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                    </span>
                  </div>

                  {note.is_issue && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-900/30 text-red-400 border border-red-500/30">
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

// Simple loader helper in Lucide format
function Loader2({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
  );
}
