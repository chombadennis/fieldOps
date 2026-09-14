import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import MilestoneClaimsIntegrations from '@/components/MilestoneClaimsIntegrations';
import CollaborationPanel from '@/components/CollaborationPanel';
import { getCurrentUser } from '@/services/api';

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
  claim_number?: string;
  status?: string;
  payment_status?: string;
  net_amount_due?: number;
  gross_amount_claimed?: number;
  values_map?: any;
  uploaded_by?: number;
  cloud_email?: string;
}

interface MilestonesTabProps {
  projectId: number;
  notes: Note[];
  documents: Document[];
  onAddNote: (note: { content: string; department: string; is_issue: boolean; priority: string }) => Promise<void>;
  integrations?: any[];
  onRefresh?: () => void;
  globalLoading?: boolean;
  setGlobalLoading?: (loading: boolean) => void;
}

export default function MilestonesTab({
  projectId,
  notes = [],
  documents = [],
  onAddNote,
  integrations = [],
  onRefresh,
  globalLoading,
  setGlobalLoading,
}: MilestonesTabProps) {
  const [content, setContent] = useState('');
  const [isIssue, setIsIssue] = useState(false);
  const [priority, setPriority] = useState('Normal');
  const [posting, setPosting] = useState(false);
  const queryClient = useQueryClient();

  // State for current user to enforce smart conditional previews
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    getCurrentUser().then(user => setCurrentUser(user)).catch(console.error);
  }, []);

  // Filter notes for this workspace
  const filteredNotes = notes.filter((note) => note.department?.toLowerCase() === 'milestone_claims');

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Header Summary Banner */}
      <div className="bg-gradient-to-r from-dark-teal-950 via-dark-teal-900 to-indigo-950 text-white rounded-3xl p-8 shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <span className="text-xs font-semibold text-emerald-400 uppercase tracking-widest">Milestone Payments Module</span>
          <h2 className="text-xl font-bold font-lexend mt-1">Milestone Claims</h2>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-xl leading-relaxed">
            Link and review work progress weighting schedules. Support for Excel spreadsheets, Word templates, and visual PDF files with inline table overrides.
          </p>
        </div>
      </div>

      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6 min-w-0">
          {/* Integrations panel */}
      <MilestoneClaimsIntegrations
        projectId={projectId}
        integrations={integrations}
        documents={documents}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['documents', projectId, 'milestone_claims'] });
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
        module="milestone_claims"
        moduleName="Milestone Claims"
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
