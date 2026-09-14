import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet } from 'lucide-react';
import ActivityScheduleIntegrations from '@/components/ActivityScheduleIntegrations';
import CollaborationPanel from '@/components/CollaborationPanel';
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
            Link and review work progress weighting schedules. Support for Excel spreadsheets, Word templates, and visual PDF files with inline table overrides.
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Integrations panel */}
      <ActivityScheduleIntegrations
        projectId={projectId}
        integrations={integrations}
        documents={activeDocuments}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'activity_schedule'] });
          if (onRefresh) onRefresh();
        }}
        globalLoading={globalLoading}
        setGlobalLoading={setGlobalLoading}
      />


        </div>
        <div className="shrink-0">
          {/* Collaboration Panel — Threads / Tasks / Log */}
      <CollaborationPanel
        projectId={projectId}
        module="activity_schedule"
        moduleName="Activity Schedule"
      />
        </div>
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
