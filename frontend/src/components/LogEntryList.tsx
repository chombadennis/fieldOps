'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getLogEntries, createLogEntry } from '@/services/api';
import { BookOpen, Loader2, CheckCircle, XCircle, ShieldCheck, AlertTriangle, TrendingUp } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface LogEntryListProps {
  projectId: number;
  module: string;
}

interface LogEntry {
  id: number;
  entry_type: string;
  title: string;
  content: string;
  posted_by_name?: string;
  task_id?: number;
  thread_id?: number;
  created_at?: string;
}

const ENTRY_TYPES = ['Decision', 'Success', 'Failure', 'Risk', 'Issue', 'Resolved'];

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  Decision: {
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30',
  },
  Success: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30',
  },
  Failure: {
    icon: <XCircle className="w-3.5 h-3.5" />,
    color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/30',
  },
  Risk: {
    icon: <TrendingUp className="w-3.5 h-3.5" />,
    color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30',
  },
  Issue: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30',
  },
  Resolved: {
    icon: <CheckCircle className="w-3.5 h-3.5" />,
    color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/30',
  },
};

const AUTHOR_NAME = 'You';

export default function LogEntryList({ projectId, module }: LogEntryListProps) {
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['log-entries', projectId, module],
    queryFn: () => getLogEntries(projectId, module),
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          {(entries as LogEntry[]).length} {(entries as LogEntry[]).length === 1 ? 'entry' : 'entries'}
        </p>
      </div>

      {/* Log Entries */}
      {(entries as LogEntry[]).length === 0 ? (
        <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10">
          <BookOpen className="w-7 h-7 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500 font-medium">No log entries yet. Complete Tasks or Resolve Threads to automatically generate project logs.</p>
        </div>
      ) : (
        <div className="relative space-y-1">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-5 bottom-2 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />

          {(entries as LogEntry[]).map((entry) => {
            const cfg = TYPE_CONFIG[entry.entry_type] || TYPE_CONFIG.Decision;
            return (
              <div key={entry.id} className="relative flex gap-4 pl-3 pb-4">
                {/* Timeline dot */}
                <div className={`relative z-10 flex-shrink-0 w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center shadow-sm`}>
                  <span className={cfg.color}>{cfg.icon}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 bg-white/[0.03] rounded-2xl border border-white/8 px-4 py-3 hover:border-white/15 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                        {entry.entry_type}
                      </span>
                      <h4 className="text-xs font-bold text-white">{entry.title}</h4>
                    </div>
                    <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0">
                      {entry.created_at ? formatDistanceToNow(new Date(entry.created_at), { addSuffix: true }) : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-gray-600">
                      Posted by {entry.posted_by_name || 'Anonymous'}
                    </span>
                    {entry.task_id && (
                      <span className="text-[10px] text-blue-500">· Linked to Task #{entry.task_id}</span>
                    )}
                    {entry.thread_id && (
                      <span className="text-[10px] text-indigo-500">· From Thread #{entry.thread_id}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
