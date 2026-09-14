'use client';

import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageSquare, CheckSquare, BookOpen } from 'lucide-react';
import ThreadList from './ThreadList';
import TaskList from './TaskList';
import LogEntryList from './LogEntryList';

interface CollaborationPanelProps {
  projectId: number;
  module: string; // 'IPC' | 'Budget' | 'Tech' | 'Field Operations' | 'HR' | 'Legal' | 'General'
  moduleName?: string; // Display name
  documents?: any[]; // Documents for linking
}

type TabId = 'threads' | 'tasks' | 'log';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'threads', label: 'Discussions', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { id: 'tasks',   label: 'Tasks',       icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { id: 'log',     label: 'Log',         icon: <BookOpen className="w-3.5 h-3.5" /> },
];

export default function CollaborationPanel({ projectId, module, moduleName, documents: propDocs = [] }: CollaborationPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('threads');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const queryClient = useQueryClient();
  
  // Try to pull documents from the global query cache safely regardless of projectId type (string/number)
  const cachedDocs = useMemo(() => {
    if (propDocs.length > 0) return propDocs;
    
    // Check both string and number variants of projectId in the cache
    const strCache = queryClient.getQueryData(['documents', String(projectId)]) as any[];
    const numCache = queryClient.getQueryData(['documents', Number(projectId)]) as any[];
    
    let allDocs = strCache || numCache || [];
    
    // Filter documents by this specific module (department) so the list isn't overwhelming
    const filtered = allDocs.filter((d: any) => 
      d.department?.toLowerCase() === module.toLowerCase() || 
      (module === 'IPC' && d.department?.toLowerCase() === 'ipc') || 
      (module === 'BoQ' && d.department?.toLowerCase() === 'boq') ||
      (module === 'tech' && d.department?.toLowerCase() === 'tech') ||
      (module === 'field_ops' && d.department?.toLowerCase() === 'field_ops')
    );
    
    return filtered;
  }, [propDocs, queryClient, projectId, module]);

  const documents = cachedDocs;

  return (
    <div className={`transition-all duration-300 bg-white/[0.03] backdrop-blur-xl rounded-3xl border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden ${isCollapsed ? 'w-16 flex flex-col items-center py-4' : 'w-full xl:w-[400px] 2xl:w-[450px]'}`}>
      {!isCollapsed ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-5 pb-0">
            <div>
              <h3 className="text-sm font-bold font-lexend text-white tracking-tight">
                Collaboration
              </h3>
              <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                {moduleName || module} · Threads, Tasks &amp; Log
              </p>
            </div>
            <button onClick={() => setIsCollapsed(true)} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors" title="Collapse Panel">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 px-6 mt-4 border-b border-white/10">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold rounded-t-xl transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-white/10 text-white border border-white/10 border-b-transparent -mb-px shadow-sm'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'threads' && (
          <ThreadList projectId={projectId} module={module} documents={documents} />
        )}
        {activeTab === 'tasks' && (
          <TaskList projectId={projectId} module={module} documents={documents} />
        )}
        {activeTab === 'log' && (
          <LogEntryList projectId={projectId} module={module} />
        )}
      </div>
        </>
      ) : (
        <>
          <button onClick={() => setIsCollapsed(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white shadow-md transition-colors" title="Expand Panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
          <div className="w-full h-px bg-white/10 my-4" />
          <div className="flex flex-col space-y-4 items-center">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setIsCollapsed(false);
                }}
                className={`p-2 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title={tab.label}
              >
                {React.isValidElement(tab.icon) ? React.cloneElement(tab.icon as React.ReactElement<any>, { className: "w-5 h-5" } as any) : tab.icon}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
